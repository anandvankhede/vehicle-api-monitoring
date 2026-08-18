"""
Dashboard Service — Aggregated Statistics & Analytics
=====================================================

Provides the business logic for all dashboard endpoints:
    - Summary stats (total clients, total APIs, healthy/degraded counts)
    - User options (client list for the global filter dropdown)
    - API options (catalog list for the monitoring dropdown)
    - User API stats (per-API KPI grid for a selected client)
    - API monitoring stats (trend + distribution for a single API)
    - Recent activity (system-wide)
    - Client analytics (filtered table data + summary)
    - Client details chart data (per-API trend for a selected client)

This service aggregates data from multiple collections (clients,
apis, api_access, usage_reports, activity_records) into the
summary objects the frontend dashboard expects.
"""

from bson import ObjectId
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any


def _oid(id_str: str) -> ObjectId:
    """Convert a string to ObjectId."""
    return ObjectId(id_str)


def _serialize(doc):
    """Serialize MongoDB document: ObjectId->str, _id->id, datetime->iso."""
    if isinstance(doc, list):
        return [_serialize(d) for d in doc]
    if doc is None:
        return None
    result = {}
    for k, v in doc.items():
        if k == "_id":
            result["id"] = str(v)
        elif isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, dict):
            result[k] = _serialize(v)
        elif isinstance(v, list):
            result[k] = [_serialize(i) if isinstance(i, dict) else i for i in v]
        elif isinstance(v, datetime):
            result[k] = v.isoformat()
        else:
            result[k] = v
    return result


# Thresholds for API health status
STATUS_HEALTHY_THRESHOLD = 95    # >= 95% success rate = healthy
STATUS_DEGRADED_THRESHOLD = 80  # >= 80% but < 95% = degraded


class DashboardService:
    """All business logic for dashboard analytics and stats."""

    # ------------------------------------------------------------------
    # Dashboard summary stats
    # ------------------------------------------------------------------

    async def get_dashboard_stats(self, db):
        """
        Return summary stats: total clients, total APIs, and
        counts of healthy vs. degraded APIs.

        The healthy/degraded classification is based on the success rate
        computed from usage_reports.
        """
        total_clients = await db["clients"].count_documents({})
        total_apis = await db["apis"].count_documents({"is_active": True})

        # Aggregate usage by API name to compute success rates
        usage_cursor = db["usage_reports"].aggregate([
            {"$match": {"created_at": {"$gte": cutoff}}},
            {"$group": {
                "_id": "$api_name",
                "total": {"$sum": "$total_requests"},
                "success": {"$sum": "$success_requests"},
            }}
        ])
        usage_list = await usage_cursor.to_list(length=None)

        healthy = 0
        degraded = 0
        for item in usage_list:
            total = item.get("total", 0)
            success = item.get("success", 0)
            rate = (success / total * 100) if total > 0 else 100
            if rate >= STATUS_HEALTHY_THRESHOLD:
                healthy += 1
            elif rate >= STATUS_DEGRADED_THRESHOLD:
                degraded += 1

        return {
            "total_clients": total_clients,
            "total_apis": total_apis,
            "healthy_apis_count": healthy,
            "degraded_apis_count": degraded,
        }

    # ------------------------------------------------------------------
    # User options (clients for the dashboard filter dropdown)
    # ------------------------------------------------------------------

    async def get_user_options(self, db):
        """
        Return the list of client options for the dashboard user filter,
        sourced from the read-optimized `user_mapping` collection.

        Only clients that actually have an access key + assigned APIs appear,
        so the dropdown stays in sync with the response DB mapping.

        Each option:
            - id:   Client ID (matches user_mapping.client_id)
            - name: Company name
            - code: Derived from username
            - type: "enterprise" | "pro" | "standard"
        """
        cursor = db["user_mapping"].find({"status": "Active"})
        mappings = await cursor.to_list(length=None)
        options = []
        for m in mappings:
            if not m.get("access_key"):
                continue
            company = m.get("company_name") or m.get("username") or "Unknown"
            code = (m.get("username") or company).upper().replace("_", "-")[:3]
            assigned = m.get("apis", [])
            if len(assigned) > 2:
                client_type = "enterprise"
            elif assigned:
                client_type = "pro"
            else:
                client_type = "standard"
            options.append({
                "id": str(m.get("client_id") or ""),
                "name": company,
                "code": code,
                "type": client_type,
            })
        return options

    # ------------------------------------------------------------------
    # API options (for monitoring dropdown)
    # ------------------------------------------------------------------

    async def get_api_options(self, db):
        """Return all active APIs from the catalog as dropdown options."""
        cursor = db["apis"].find({"is_active": True})
        docs = await cursor.to_list(length=None)
        return [{"id": str(d["_id"]), "name": d["name"], "category": d.get("category", "vehicle")}
                for d in docs]

    # ------------------------------------------------------------------
    # User API stats (KPI grid for selected client)
    # ------------------------------------------------------------------

    async def get_user_api_stats(self, db, client_id: str):
        """
        Return per-API KPI cards for a selected client.
        Aggregates usage_reports for the given client_id.
        """
        client = await db["clients"].find_one({"_id": _oid(client_id)})
        if not client:
            return []

        cursor = db["usage_reports"].find({"client_id": _oid(client_id)})
        reports = await cursor.to_list(length=None)

        # Get API catalog for category lookup
        apis = await db["apis"].find().to_list(length=None)
        api_map = {a["name"]: a for a in apis}

        # Aggregate per-API
        stats_map: Dict[str, dict] = {}
        for r in reports:
            api_name = r.get("api_name", "Unknown")
            if api_name not in stats_map:
                stats_map[api_name] = {
                    "id": str(r["_id"]),
                    "name": api_name,
                    "category": api_map.get(api_name, {}).get("category", "vehicle"),
                    "total_hits": 0, "success": 0, "not_found": 0, "failed": 0,
                    "response_times": [],
                }
            s = stats_map[api_name]
            s["total_hits"] += r.get("total_requests", 0)
            s["success"] += r.get("success_requests", 0)
            s["not_found"] += r.get("not_found_requests", 0)
            s["failed"] += r.get("failed_requests", 0)
            if r.get("avg_response_time", 0):
                s["response_times"].append(r["avg_response_time"])

        result = []
        for api_name, s in stats_map.items():
            total = s["total_hits"]
            rate = (s["success"] / total * 100) if total > 0 else 100
            avg_rt = int(sum(s["response_times"]) / len(s["response_times"])) if s["response_times"] else 0

            if rate >= STATUS_HEALTHY_THRESHOLD:
                status = "healthy"
            elif rate >= STATUS_DEGRADED_THRESHOLD:
                status = "degraded"
            else:
                status = "down"

            result.append({
                "id": s["id"],
                "name": s["name"],
                "category": s["category"],
                "total_hits": total,
                "success": s["success"],
                "not_found": s["not_found"],
                "failed": s["failed"],
                "status": status,
                "trend_percentage": 4.8,
                "trend_direction": "up",
                "avg_response_time_ms": avg_rt,
            })
        return result

    # ------------------------------------------------------------------
    # API monitoring stats (single API detailed view)
    # ------------------------------------------------------------------

    async def get_api_monitoring_stats(self, db, api_id: str, time_filter: str = "24h"):
        """
        Return detailed monitoring stats for a single API:
        distribution (pie), trend data (line), and summary metrics.
        """
        api = await db["apis"].find_one({"_id": _oid(api_id)})
        if not api:
            raise ValueError("API not found")

        api_name = api["name"]
        now = datetime.now(timezone.utc)
        hours_map = {"24h": 24, "7d": 168, "30d": 720, "1h": 1}
        hours = hours_map.get(time_filter, 24)

        cursor = db["usage_reports"].find({"api_name": api_name})
        reports = await cursor.to_list(length=None)

        total_hits = sum(r.get("total_requests", 0) for r in reports)
        success_total = sum(r.get("success_requests", 0) for r in reports)
        failed_total = sum(r.get("failed_requests", 0) for r in reports)
        not_found_total = sum(r.get("not_found_requests", 0) for r in reports)
        avg_rt_values = [r.get("avg_response_time", 0) for r in reports if r.get("avg_response_time", 0)]
        avg_latency = int(sum(avg_rt_values) / len(avg_rt_values)) if avg_rt_values else 0
        success_rate = round((success_total / total_hits * 100) if total_hits > 0 else 0, 2)

        distribution = [
            {"name": "Success", "value": success_total, "color": "#22c55e",
             "percentage": round((success_total / total_hits * 100) if total_hits else 0, 1)},
            {"name": "Failed", "value": failed_total, "color": "#ef4444",
             "percentage": round((failed_total / total_hits * 100) if total_hits else 0, 1)},
            {"name": "Not Found", "value": not_found_total, "color": "#f59e0b",
             "percentage": round((not_found_total / total_hits * 100) if total_hits else 0, 1)},
        ]

        trend_data = [{
            "time": r.get("date", str(r.get("created_at", ""))[:10]),
            "total": r.get("total_requests", 0),
            "success": r.get("success_requests", 0),
            "failed": r.get("failed_requests", 0),
            "not_found": r.get("not_found_requests", 0),
        } for r in sorted(reports, key=lambda x: x.get("created_at", datetime.min))]

        return {
            "api_id": str(api["_id"]),
            "api_name": api["name"],
            "time_filter": time_filter,
            "distribution": distribution,
            "trend_data": trend_data,
            "total_hits": total_hits,
            "success_rate": success_rate,
            "avg_latency_ms": avg_latency,
            "uptime_percentage": round(success_rate, 2),
        }

    # ------------------------------------------------------------------
    # Recent activity (dashboard feed)
    # ------------------------------------------------------------------

    async def get_recent_activity(self, db, limit: int = 10):
        """Return recent activity records for the dashboard activity feed."""
        cursor = db["activity_records"].find().sort("date", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [{
            "id": str(d["_id"]),
            "type": d.get("type", ""),
            "title": d.get("title", ""),
            "message": d.get("message", ""),
            "date": d.get("date"),
            "status": d.get("status", ""),
        } for d in docs]

    # ------------------------------------------------------------------
    # Client analytics (filtered table)
    # ------------------------------------------------------------------

    async def get_client_analytics_data(self, db, client_id="all", api_id="all",
                                        time_filter="today", status_filter="all",
                                        search_query="", sort_by="totalHits",
                                        sort_order="desc", start_date=None, end_date=None):
        """
        Return filtered, sorted client analytics data.
        Aggregates usage_reports and joins with clients collection.
        """
        from app.utils.helpers import parse_date_string
        now = datetime.now(timezone.utc)

        # Date range
        if start_date and end_date:
            start_dt = parse_date_string(start_date) or datetime.min.replace(tzinfo=timezone.utc)
            end_dt = parse_date_string(end_date) or now
        else:
            range_map = {
                "today": (now.replace(hour=0, minute=0, second=0), now),
                "week": (now - timedelta(days=7), now),
                "month": (now - timedelta(days=30), now),
                "year": (now - timedelta(days=365), now),
                "all": (datetime.min.replace(tzinfo=timezone.utc), now),
            }
            start_dt, end_dt = range_map.get(time_filter, range_map["today"])

        # Build aggregation pipeline
        match = {"created_at": {"$gte": start_dt, "$lte": end_dt}}
        if client_id != "all":
            match["client_id"] = _oid(client_id)
        if api_id != "all":
            api_doc = await db["apis"].find_one({"_id": _oid(api_id)})
            if api_doc:
                match["api_name"] = api_doc["name"]

        pipeline = [{"$match": match}, {
            "$group": {
                "_id": {"client_id": "$client_id", "api_name": "$api_name"},
                "total_hits": {"$sum": "$total_requests"},
                "success": {"$sum": "$success_requests"},
                "failed": {"$sum": "$failed_requests"},
                "not_found": {"$sum": "$not_found_requests"},
                "avg_rt": {"$avg": "$avg_response_time"},
            }
        }]

        grouped = await db["usage_reports"].aggregate(pipeline).to_list(length=None)

        records = []
        for g in grouped:
            cid = g["_id"]["client_id"]
            client = await db["clients"].find_one({"_id": cid})
            if not client:
                continue
            total = g["total_hits"]
            rate = round((g["success"] / total * 100) if total > 0 else 0, 1)
            avg_rt = int(g.get("avg_rt", 0) or 0)

            record = {
                "id": str(cid),
                "client_id": str(cid),
                "client_name": client.get("company_name", "Unknown"),
                "client_code": client.get("username", "").upper().replace("_", "-"),
                "api_id": str(cid),
                "api_name": g["_id"]["api_name"],
                "api_category": "vehicle",
                "total_hits": total,
                "success": g["success"],
                "failed": g["failed"],
                "not_found": g["not_found"],
                "avg_response_time_ms": avg_rt,
                "success_rate": rate,
                "timestamp": now.isoformat(),
                "date": now.strftime("%Y-%m-%d"),
            }

            if search_query and search_query.lower() not in record["client_name"].lower():
                continue
            if status_filter == "success" and rate < 95:
                continue
            elif status_filter == "failed" and rate >= 95:
                continue
            elif status_filter == "not_found" and rate >= 80:
                continue

            records.append(record)

        reverse = sort_order == "desc"
        records.sort(key=lambda r: r.get(sort_by.lower(), 0), reverse=reverse)

        total_hits = sum(r["total_hits"] for r in records)
        overall_rate = round((sum(r["success"] for r in records) / total_hits * 100) if total_hits > 0 else 0, 1)
        avg_rt = int(sum(r["avg_response_time_ms"] for r in records) / len(records)) if records else 0

        return {
            "records": records,
            "summary": {
                "total_clients": len(records),
                "total_apis": len(set(r["api_name"] for r in records)),
                "total_hits": total_hits,
                "overall_success_rate": overall_rate,
                "avg_response_time_ms": avg_rt,
            },
            "total_records": len(records),
            "filtered_records": len(records),
        }

    # ------------------------------------------------------------------
    # Client details chart data
    # ------------------------------------------------------------------

    async def get_client_details_data(self, db, client_id: str, time_filter: str = "24h"):
        """
        Return per-API trend data for a selected client.
        """
        client = await db["clients"].find_one({"_id": _oid(client_id)})
        if not client:
            raise ValueError("Client not found")

        cursor = db["usage_reports"].find({"client_id": _oid(client_id)})
        reports = await cursor.to_list(length=None)

        apis = await db["apis"].find().to_list(length=None)
        api_map = {a["name"]: a for a in apis}

        api_groups: Dict[str, list] = {}
        for r in reports:
            api_groups.setdefault(r.get("api_name", "Unknown"), []).append(r)

        apis_data = []
        for api_name, api_reports in api_groups.items():
            total = sum(r.get("total_requests", 0) for r in api_reports)
            success = sum(r.get("success_requests", 0) for r in api_reports)
            failed = sum(r.get("failed_requests", 0) for r in api_reports)
            not_found = sum(r.get("not_found_requests", 0) for r in api_reports)
            rt_vals = [r.get("avg_response_time", 0) for r in api_reports if r.get("avg_response_time", 0)]
            avg_rt = int(sum(rt_vals) / len(rt_vals)) if rt_vals else 0

            trend_data = [{
                "time": r.get("date", str(r.get("created_at", ""))[:10]),
                "total": r.get("total_requests", 0),
                "success": r.get("success_requests", 0),
                "failed": r.get("failed_requests", 0),
                "not_found": r.get("not_found_requests", 0),
            } for r in sorted(api_reports, key=lambda x: x.get("created_at", datetime.min))]

            apis_data.append({
                "api_id": str(api_map.get(api_name, {}).get("_id", "")),
                "api_name": api_name,
                "category": api_map.get(api_name, {}).get("category", "vehicle"),
                "total_hits": total,
                "success": success,
                "failed": failed,
                "not_found": not_found,
                "avg_response_time_ms": avg_rt,
                "trend_data": trend_data,
            })

        return {
            "client_id": str(client["_id"]),
            "client_name": client.get("company_name", "Unknown"),
            "time_filter": time_filter,
            "apis": apis_data,
        }

    # ------------------------------------------------------------------
    # API usage stats
    # ------------------------------------------------------------------

    async def get_api_usage_stats(self, db, api_name: str, time_filter: str = "7d"):
        """
        Return usage stats for a specific API.
        """
        now = datetime.now(timezone.utc)
        range_map = {
            "24h": now - timedelta(days=1),
            "7d": now - timedelta(days=7),
            "30d": now - timedelta(days=30),
            "90d": now - timedelta(days=90),
            "all": datetime.min.replace(tzinfo=timezone.utc),
        }
        cutoff = range_map.get(time_filter, range_map["7d"])

        cursor = db["usage_reports"].find({
            "api_name": api_name,
            "created_at": {"$gte": cutoff}
        })
        reports = await cursor.to_list(length=None)

        total = sum(r.get("total_requests", 0) for r in reports)
        success = sum(r.get("success_requests", 0) for r in reports)
        failed = sum(r.get("failed_requests", 0) for r in reports)
        not_found = sum(r.get("not_found_requests", 0) for r in reports)

        return {
            "api_name": api_name,
            "time_filter": time_filter,
            "distribution": [
                {"name": "Success", "value": success, "color": "#22c55e"},
                {"name": "Failed", "value": failed, "color": "#ef4444"},
                {"name": "Not Found", "value": not_found, "color": "#f59e0b"},
            ],
            "trend_data": [{
                "time": r.get("date", ""),
                "total": r.get("total_requests", 0),
                "success": r.get("success_requests", 0),
                "failed": r.get("failed_requests", 0),
                "not_found": r.get("not_found_requests", 0),
            } for r in sorted(reports, key=lambda x: x.get("created_at", datetime.min))],
            "total_requests": total,
            "success_requests": success,
            "failed_requests": failed,
            "not_found_requests": not_found,
            "avg_response_time": int(sum(r.get("avg_response_time", 0) for r in reports) / len(reports)) if reports else 0,
        }

    # ------------------------------------------------------------------
    # Top APIs (for monthly report)
    # ------------------------------------------------------------------

    async def get_top_apis(self, db, time_filter: str = "month"):
        """Return top APIs by usage count."""
        now = datetime.now(timezone.utc)
        range_map = {
            "month": now - timedelta(days=30),
            "week": now - timedelta(days=7),
            "year": now - timedelta(days=365),
        }
        cutoff = range_map.get(time_filter, range_map["month"])

        cursor = db["usage_reports"].aggregate([
            {"$match": {"created_at": {"$gte": cutoff}}},
            {"$group": {
                "_id": "$api_name",
                "count": {"$sum": "$total_requests"},
            }},
            {"$sort": {"count": -1}},
        ])
        docs = await cursor.to_list(length=None)
        total = sum(d["count"] for d in docs)
        return [{"api_name": d["_id"], "count": d["count"],
                 "percentage": round(d["count"] / total * 100, 1) if total > 0 else 0}
                for d in docs]
