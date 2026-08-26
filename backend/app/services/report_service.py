"""
Report Service — Usage Reports & Billing
========================================

Business logic for:
    - Daily usage report (per-API daily stats)
    - Monthly billing report (monthly consumption + cost)
    - API stats overview (table view with invoice status)
    - Invoice generation (create invoice from usage reports)
    - Invoice listing (all invoices with optional filtering)
    - Report export (CSV/Excel/PDF generation)

Data sources: usage_reports, api_access, invoices, clients collections.
"""

from bson import ObjectId
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
import csv
import io

from app.services.api_collections import (
    get_catalog_api_names,
    get_response_collection_for_api,
)
from app.services.response_db_guard import response_db_aggregate


def _oid(id_str: str) -> ObjectId:
    """Convert a string to ObjectId."""
    return ObjectId(id_str)


def _today_utc() -> datetime:
    """Return today's date at midnight UTC."""
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def _report_time_bounds(time_filter: str = "month",
                        start_date: Optional[str] = None,
                        end_date: Optional[str] = None):
    """Compute [start, end) `created_time` string bounds for report date filters."""
    now = datetime.now(timezone.utc)
    t0 = now.replace(hour=0, minute=0, second=0, microsecond=0)
    fmt = lambda d: d.strftime("%Y-%m-%d %H:%M:%S")

    # Explicit custom date range overrides the preset filter.
    if start_date or end_date:
        try:
            sd = datetime.strptime(str(start_date).strip()[:10], "%Y-%m-%d") if start_date else t0.replace(tzinfo=None)
            ed = datetime.strptime(str(end_date).strip()[:10], "%Y-%m-%d") if end_date else sd
            lo = sd.replace(hour=0, minute=0, second=0, microsecond=0)
            hi = ed.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            return fmt(lo), fmt(hi)
        except ValueError:
            pass

    if time_filter == "today":
        return fmt(t0), fmt(t0 + timedelta(days=1))
    if time_filter in ("week", "last_7_days"):
        return fmt(t0 - timedelta(days=6)), fmt(t0 + timedelta(days=1))
    if time_filter == "month":
        return fmt(now - timedelta(days=30)), fmt(now + timedelta(days=1))
    if time_filter == "year":
        return fmt(now - timedelta(days=365)), fmt(now + timedelta(days=1))
    if time_filter == "all":
        return "1970-01-01 00:00:00", "2099-12-31 23:59:59"
    return fmt(t0 - timedelta(days=6)), fmt(t0 + timedelta(days=1))


class ReportService:
    """All business logic for reports and billing."""

    # ------------------------------------------------------------------
    # Daily usage report
    # ------------------------------------------------------------------

    async def get_daily_usage_report(self, db, client_id: Optional[str] = None,
                                      time_filter: str = "month"):
        """
        Return daily usage report data (array of per-day stats).

        If client_id is provided, filter to that client's usage.
        Otherwise, aggregate across all clients.

        Args:
            db:         Motor database.
            client_id:  Optional ObjectId string to filter by client.
            time_filter: "today" | "week" | "month" | "year" | "all"
        """
        now = datetime.now(timezone.utc)
        range_map = {
            "today": (now.replace(hour=0, minute=0, second=0), now),
            "week": (now - timedelta(days=7), now),
            "month": (now - timedelta(days=30), now),
            "year": (now - timedelta(days=365), now),
            "all": (datetime.min.replace(tzinfo=timezone.utc), now),
        }
        start_dt, end_dt = range_map.get(time_filter, range_map["month"])

        match = {"created_at": {"$gte": start_dt, "$lte": end_dt}}
        if client_id:
            match["client_id"] = _oid(client_id)

        # Group by date
        pipeline = [
            {"$match": match},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "success_requests": {"$sum": "$success_requests"},
                "failed_requests": {"$sum": "$failed_requests"},
                "not_found_requests": {"$sum": "$not_found_requests"},
                "total_requests": {"$sum": "$total_requests"},
                "revenue": {"$sum": "$revenue"},
                "cost": {"$sum": "$cost"},
            }},
            {"$sort": {"_id": 1}},
        ]

        cursor = db["usage_reports"].aggregate(pipeline)
        docs = await cursor.to_list(length=None)

        daily_report = []
        for d in docs:
            total = d["total_requests"]
            daily_report.append({
                "date": d["_id"],
                "success_requests": d["success_requests"],
                "failed_requests": d["failed_requests"],
                "not_found_requests": d["not_found_requests"],
                "total_requests": total,
                "revenue": round(d.get("revenue", 0), 2),
                "cost": round(d.get("cost", 0), 2),
                "avg_response_time": 0,
            })

        return daily_report

    # ------------------------------------------------------------------
    # Daily usage report (from response DB, by access key)
    # ------------------------------------------------------------------

    async def get_daily_usage_report_from_response_db(self, response_db, db, client_id=None,
                                              time_filter="month", start_date=None,
                                              end_date=None):
        """
        Daily usage report for one client, aggregated from the response
        collections by matching `access_key` (the client's real API key) +
        created_time string window, per calendar day and status bucket.

        Response codes: 101 -> success | 103 -> not_found |
                        110 (and anything else) -> failed.
        Cost/revenue is derived from the client's api_access pricing.
        """
        if not client_id:
            return []
        try:
            oid = ObjectId(client_id)
        except Exception:
            return []
        mapping = await db["user_mapping"].find_one({"client_id": oid})
        if not mapping:
            return []
        access_key = mapping.get("access_key")
        catalog = set(await get_catalog_api_names(db))
        names = [n for n in (mapping.get("apis") or []) if n in catalog]
        if not access_key or not names:
            return []

        price = {}
        async for a in db["api_access"].find(
            {"client_id": oid},
            {"api_name": 1, "success_price_per_hit": 1, "not_found_price_per_hit": 1},
        ):
            nm = a.get("api_name")
            if nm:
                price[nm] = (float(a.get("success_price_per_hit") or 0),
                             float(a.get("not_found_price_per_hit") or 0))

        start_str, end_str = _report_time_bounds(time_filter, start_date, end_date)
        day_map = {}

        async def _agg(name):
            coll = get_response_collection_for_api(name)
            if not coll:
                return
            pipeline = [
                {"$match": {"access_key": access_key,
                            "created_time": {"$gte": start_str, "$lt": end_str}}},
                {"$group": {"_id": {"date": {"$substr": ["$created_time", 0, 10]},
                                    "code": "$response.response_code"},
                            "count": {"$sum": 1}}},
            ]
            try:
                docs = await response_db_aggregate(response_db[coll], pipeline)
            except Exception:
                return
            sp, np = price.get(name, (0.0, 0.0))
            for g in docs:
                date = g["_id"].get("date", "")
                code = str(g["_id"].get("code", "")).strip()
                cnt = int(g.get("count", 0))
                row = day_map.setdefault(
                    date, {"success": 0, "failed": 0, "not_found": 0, "cost": 0.0})
                if code in ("101", "200"):
                    row["success"] += cnt
                    row["cost"] += cnt * sp
                elif code == "103":
                    row["not_found"] += cnt
                    row["cost"] += cnt * np
                else:
                    row["failed"] += cnt

        for name in names:
            await _agg(name)

        result = []
        for date in sorted(day_map.keys()):
            r = day_map[date]
            total = r["success"] + r["not_found"] + r["failed"]
            result.append({
                "date": date,
                "success_requests": r["success"],
                "failed_requests": r["failed"],
                "not_found_requests": r["not_found"],
                "total_requests": total,
                "revenue": round(r["cost"], 2),
                "cost": round(r["cost"], 2),
                "avg_response_time": 0,
            })
        return result

    # ------------------------------------------------------------------
    # Monthly billing report (from response DB, by access key)
    # ------------------------------------------------------------------

    async def get_monthly_billing_report_from_response_db(self, response_db, db, client_id=None,
                                                  month=None):
        """
        Monthly consumption/billing report aggregated from the response
        collections by the client's `access_key`, with API-wise counts, top
        APIs, peak usage date and derived cost from api_access pricing.
        """
        if not client_id:
            return None
        try:
            oid = ObjectId(client_id)
        except Exception:
            return None
        mapping = await db["user_mapping"].find_one({"client_id": oid})
        if not mapping:
            return None
        access_key = mapping.get("access_key")
        catalog = set(await get_catalog_api_names(db))
        names = [n for n in (mapping.get("apis") or []) if n in catalog]
        if not access_key or not names:
            return None

        now = datetime.now(timezone.utc)
        if month:
            try:
                y, m = (int(x) for x in str(month).split("-"))
            except Exception:
                y, m = now.year, now.month
        else:
            y, m = now.year, now.month

        first = datetime(y, m, 1)
        nxt = datetime(y + 1, 1, 1) if m == 12 else datetime(y, m + 1, 1)
        start_str = first.strftime("%Y-%m-%d 00:00:00")
        end_str = nxt.strftime("%Y-%m-%d 00:00:00")
        days_in_month = (nxt - first).days

        price = {}
        async for a in db["api_access"].find(
            {"client_id": oid},
            {"api_name": 1, "success_price_per_hit": 1, "not_found_price_per_hit": 1},
        ):
            nm = a.get("api_name")
            if nm:
                price[nm] = (float(a.get("success_price_per_hit") or 0),
                             float(a.get("not_found_price_per_hit") or 0))

        api_totals = {}
        day_counts = {}

        async def _agg(name):
            coll = get_response_collection_for_api(name)
            if not coll:
                return
            pipeline = [
                {"$match": {"access_key": access_key,
                            "created_time": {"$gte": start_str, "$lt": end_str}}},
                {"$facet": {
                    "by_code": [{"$group": {"_id": "$response.response_code",
                                            "count": {"$sum": 1}}}],
                    "by_date": [{"$group": {"_id": {"$substr": ["$created_time", 0, 10]},
                                            "count": {"$sum": 1}}}],
                }},
            ]
            try:
                docs = await response_db_aggregate(response_db[coll], pipeline)
            except Exception:
                return
            d = docs[0] if docs else {}
            ainfo = api_totals.setdefault(
                name, {"success": 0, "not_found": 0, "failed": 0})
            for g in d.get("by_code", []):
                code = str(g.get("_id", "")).strip()
                cnt = int(g.get("count", 0))
                if code in ("101", "200"):
                    ainfo["success"] += cnt
                elif code == "103":
                    ainfo["not_found"] += cnt
                else:
                    ainfo["failed"] += cnt
            for g in d.get("by_date", []):
                date = g.get("_id", "")
                day_counts[date] = day_counts.get(date, 0) + int(g.get("count", 0))

        for name in names:
            await _agg(name)

        total = sum(ainfo["success"] + ainfo["not_found"] + ainfo["failed"]
                    for ainfo in api_totals.values())
        success = sum(a["success"] for a in api_totals.values())
        not_found = sum(a["not_found"] for a in api_totals.values())
        failed = sum(a["failed"] for a in api_totals.values())

        total_cost = 0.0
        for name, ainfo in api_totals.items():
            sp, np = price.get(name, (0.0, 0.0))
            total_cost += ainfo["success"] * sp + ainfo["not_found"] * np

        top_apis = sorted(
            ({"api_name": n,
              "count": a["success"] + a["not_found"] + a["failed"],
              "percentage": round((a["success"] + a["not_found"] + a["failed"]) / total * 100, 1)
              if total else 0}
             for n, a in api_totals.items()),
            key=lambda x: x["count"], reverse=True)

        fail_total = sum(a["failed"] for a in api_totals.values())
        top_failure_apis = sorted(
            ({"api_name": n, "count": a["failed"],
              "percentage": round(a["failed"] / fail_total * 100, 1) if fail_total else 0}
             for n, a in api_totals.items() if a["failed"] > 0),
            key=lambda x: x["count"], reverse=True)

        peak_date = max(day_counts, key=day_counts.get) if day_counts else None

        return {
            "month": f"{y:04d}-{m:02d}",
            "year": y,
            "total_requests": total,
            "success_requests": success,
            "failed_requests": failed,
            "not_found_requests": not_found,
            "total_cost": round(total_cost, 2),
            "total_revenue": round(total_cost, 2),
            "avg_daily_usage": round(total / days_in_month, 1) if days_in_month else 0,
            "top_apis": top_apis,
            "top_failure_apis": top_failure_apis[:5],
            "peak_usage_date": peak_date or "",
        }

    # ------------------------------------------------------------------
    # Monthly billing report
    # ------------------------------------------------------------------

    async def get_monthly_billing_report(self, db, client_id: Optional[str] = None,
                                         month: Optional[str] = None):
        """
        Return monthly consumption report data.

        Args:
            db:        Motor database.
            client_id: Optional ObjectId string to filter by client.
            month:     "YYYY-MM" string; defaults to current month.
        """
        now = datetime.now(timezone.utc)
        if not month:
            month = now.strftime("%Y-%m")

        year = int(month.split("-")[0])
        month_num = int(month.split("-")[1])

        # Build date range for the month
        start_dt = datetime(year, month_num, 1, tzinfo=timezone.utc)
        if month_num == 12:
            end_dt = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_dt = datetime(year, month_num + 1, 1, tzinfo=timezone.utc)

        match = {"created_at": {"$gte": start_dt, "$lte": end_dt}}
        if client_id:
            match["client_id"] = _oid(client_id)

        # Get daily daily reports for the month
        cursor = db["usage_reports"].find(match)
        daily_reports = await cursor.to_list(length=None)

        total_requests = sum(r.get("total_requests", 0) for r in daily_reports)
        success_requests = sum(r.get("success_requests", 0) for r in daily_reports)
        failed_requests = sum(r.get("failed_requests", 0) for r in daily_reports)
        not_found_requests = sum(r.get("not_found_requests", 0) for r in daily_reports)
        total_cost = round(sum(r.get("cost", 0) for r in daily_reports), 2)
        total_revenue = round(sum(r.get("revenue", 0) for r in daily_reports), 2)

        # Get top APIs by usage
        api_cursor = db["usage_reports"].aggregate([
            {"$match": match},
            {"$group": {
                "_id": "$api_name",
                "count": {"$sum": "$total_requests"},
            }},
            {"$sort": {"count": -1}},
        ])
        api_docs = await api_cursor.to_list(length=None)

        total_api_hits = sum(d["count"] for d in api_docs)
        top_apis = [{
            "api_name": d["_id"],
            "count": d["count"],
            "percentage": round(d["count"] / total_api_hits * 100, 1) if total_api_hits > 0 else 0
        } for d in api_docs[:5]]

        # Get top failure APIs
        failure_cursor = db["usage_reports"].aggregate([
            {"$match": match},
            {"$group": {
                "_id": "$api_name",
                "failures": {"$sum": {"$add": ["$failed_requests", "$not_found_requests"]}},
            }},
            {"$sort": {"failures": -1}},
        ])
        failure_docs = await failure_cursor.to_list(length=None)
        top_failure_apis = [{
            "api_name": d["_id"],
            "count": d["failures"],
            "percentage": round(d["failures"] / (total_requests or 1) * 100, 1)
        } for d in failure_docs[:5]]

        # Peak usage date
        peak_cursor = db["usage_reports"].aggregate([
            {"$match": match},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "total": {"$sum": "$total_requests"},
            }},
            {"$sort": {"total": -1}},
            {"$limit": 1},
        ])
        peak_doc = await peak_cursor.to_list(length=1)
        peak_date = peak_doc[0]["_id"] if peak_doc else now.strftime("%Y-%m-%d")

        # Average daily usage
        num_days = len(set(r.get("created_at", now).strftime("%Y-%m-%d") for r in daily_reports)) or 1
        avg_daily_usage = int(total_requests / num_days)

        return {
            "month": month,
            "year": year,
            "total_requests": total_requests,
            "success_requests": success_requests,
            "failed_requests": failed_requests,
            "not_found_requests": not_found_requests,
            "total_cost": total_cost,
            "total_revenue": total_revenue,
            "avg_daily_usage": avg_daily_usage,
            "top_apis": top_apis,
            "top_failure_apis": top_failure_apis,
            "peak_usage_date": peak_date,
        }

    # ------------------------------------------------------------------
    # API stats + table data
    # ------------------------------------------------------------------

    async def get_report_table_data(self, db, status: str = "all",
                                     api_name: Optional[str] = None,
                                     client_name: Optional[str] = None,
                                     date_range: Optional[str] = None,
                                     start_date: Optional[str] = None,
                                     end_date: Optional[str] = None):
        """
        Return detailed report table rows with invoice status info.

        This powers the UsageReports page's detailed table.
        """
        from app.utils.helpers import parse_date_string

        now = datetime.now(timezone.utc)
        match = {}

        # Date filtering
        if start_date and end_date:
            sd = parse_date_string(start_date)
            ed = parse_date_string(end_date)
            if sd and ed:
                match["created_at"] = {"$gte": sd, "$lte": ed}
        elif date_range:
            range_map = {
                "7d": now - timedelta(days=7),
                "30d": now - timedelta(days=30),
                "90d": now - timedelta(days=90),
                "all": datetime.min.replace(tzinfo=timezone.utc),
            }
            cutoff = range_map.get(date_range, range_map["30d"])
            match["created_at"] = {"$gte": cutoff}

        if api_name:
            match["api_name"] = api_name

        # Get all usage reports matching
        cursor = db["usage_reports"].find(match)
        reports = await cursor.to_list(length=None)

        # Get all invoices for status lookup
        invoice_cursor = db["invoices"].find()
        invoices = await invoice_cursor.to_list(length=None)
        invoice_by_month = {}
        for inv in invoices:
            key = (inv.get("billing_period_start", ""), inv.get("client_id"))
            invoice_by_month[key] = inv

        rows = []
        row_id = 0
        for r in reports:
            cid = r.get("client_id")
            client = None
            if cid:
                client = await db["clients"].find_one({"_id": cid})

            # Determine invoice month
            date_str = r.get("date", "")
            if not date_str:
                dt = r.get("created_at", now)
                if isinstance(dt, str):
                    date_str = dt[:10]
                elif isinstance(dt, datetime):
                    date_str = dt.strftime("%Y-%m-%d")

            inv_status = "pending"
            inv_month = date_str[:7] if date_str else ""
            inv_year = int(date_str[:4]) if date_str else 0
            inv_key = (inv_month, cid)
            if inv_key in invoice_by_month:
                inv_status = invoice_by_month[inv_key].get("status", "pending")

            # Skip if client_name filter doesn't match
            if client_name and client:
                if client_name.lower() not in client.get("company_name", "").lower():
                    continue

            total = r.get("total_requests", 0)
            success = r.get("success_requests", 0)
            failed = r.get("failed_requests", 0)
            not_found = r.get("not_found_requests", 0)
            cost = round(r.get("cost", 0), 2)

            rows.append({
                "id": str(row_id),
                "date": date_str,
                "client_name": client.get("company_name", "Unknown") if client else "Unknown",
                "api_name": r.get("api_name", "Unknown"),
                "endpoint": r.get("endpoint", "N/A"),
                "success": success,
                "failed": failed,
                "not_found": not_found,
                "total_requests": total,
                "success_cost": round(r.get("revenue", 0) * 0.8, 2),
                "not_found_cost": round(r.get("cost", 0) * 0.2, 2),
                "total_cost": cost,
                "avg_response_time": r.get("avg_response_time", 0),
                "invoice_status": inv_status if status == "all" or inv_status == status else inv_status,
                "invoice_month": inv_month if inv_month else None,
                "invoice_year": inv_year if inv_year else None,
            })
            row_id += 1

        return {"data": rows, "total": len(rows)}

    # ------------------------------------------------------------------
    # Usage summary (overview stats)
    # ------------------------------------------------------------------

    async def get_usage_summary(self, db, api_name: Optional[str] = None,
                                 time_filter: str = "7d"):
        """
        Return aggregate usage summary stats.

        Returned by GET /reports/api-stats.
        """
        now = datetime.now(timezone.utc)
        range_map = {
            "24h": now - timedelta(hours=24),
            "7d": now - timedelta(days=7),
            "30d": now - timedelta(days=30),
            "90d": now - timedelta(days=90),
            "all": datetime.min.replace(tzinfo=timezone.utc),
        }
        cutoff = range_map.get(time_filter, range_map["7d"])

        match = {"created_at": {"$gte": cutoff}}
        if api_name:
            match["api_name"] = api_name

        cursor = db["usage_reports"].find(match)
        reports = await cursor.to_list(length=None)

        total_hits = sum(r.get("total_requests", 0) for r in reports)
        successful = sum(r.get("success_requests", 0) for r in reports)
        failed = sum(r.get("failed_requests", 0) for r in reports)
        not_found = sum(r.get("not_found_requests", 0) for r in reports)
        revenue = sum(r.get("revenue", 0) for r in reports)
        cost = sum(r.get("cost", 0) for r in reports)
        rt_values = [r.get("avg_response_time", 0) for r in reports if r.get("avg_response_time", 0)]
        avg_rt = round(sum(rt_values) / len(rt_values), 1) if rt_values else 0
        success_rate = round((successful / total_hits * 100) if total_hits > 0 else 0, 2)

        return {
            "total_hits": total_hits,
            "successful_requests": successful,
            "failed_requests": failed,
            "not_found_requests": not_found,
            "total_revenue": round(revenue, 2),
            "total_cost": round(cost, 2),
            "avg_response_time": avg_rt,
            "success_rate": success_rate,
        }

    # ------------------------------------------------------------------
    # Invoice generation
    # ------------------------------------------------------------------

    async def generate_invoice(self, db, client_id: str, month: str, gst_percentage: float = 18.0):
        """
        Generate an invoice for a client for a given month.

        Reads usage_reports for the month, computes per-API costs
        using the client's api_access pricing, and creates an invoice.
        """
        year = int(month.split("-")[0])
        month_num = int(month.split("-")[1])
        start_dt = datetime(year, month_num, 1, tzinfo=timezone.utc)
        if month_num == 12:
            end_dt = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_dt = datetime(year, month_num + 1, 1, tzinfo=timezone.utc)

        # Get client
        client = await db["clients"].find_one({"_id": _oid(client_id)})
        if not client:
            raise ValueError("Client not found")

        # Get usage reports for this client in this month
        cursor = db["usage_reports"].find({
            "client_id": _oid(client_id),
            "created_at": {"$gte": start_dt, "$lte": end_dt}
        })
        reports = await cursor.to_list(length=None)

        # Get API access for pricing
        access_cursor = db["api_access"].find({"client_id": _oid(client_id)})
        access_records = await access_cursor.to_list(length=None)
        price_map = {a["api_name"]: a for a in access_records}

        # Build per-API usage items
        api_usage: Dict[str, dict] = {}
        subtotal = 0.0
        currency = "INR"

        for r in reports:
            api_name = r.get("api_name", "Unknown")
            if api_name not in api_usage:
                access = price_map.get(api_name, {})
                api_usage[api_name] = {
                    "api_name": api_name,
                    "success_requests": 0,
                    "not_found_requests": 0,
                    "success_cost": 0.0,
                    "not_found_cost": 0.0,
                    "total_cost": 0.0,
                }
                currency = access.get("currency", currency)

            success = r.get("success_requests", 0)
            not_found = r.get("not_found_requests", 0)
            access = price_map.get(api_name, {})
            success_price = access.get("success_price_per_hit", 0.5)
            not_found_price = access.get("not_found_price_per_hit", 0.5)

            api_usage[api_name]["success_requests"] += success
            api_usage[api_name]["not_found_requests"] += not_found
            api_usage[api_name]["success_cost"] += success * success_price
            api_usage[api_name]["not_found_cost"] += not_found * not_found_price
            subtotal += success * success_price + not_found * not_found_price

        # Finalize item costs
        items = []
        for api_name, usage in api_usage.items():
            usage["success_cost"] = round(usage["success_cost"], 2)
            usage["not_found_cost"] = round(usage["not_found_cost"], 2)
            usage["total_cost"] = round(usage["success_cost"] + usage["not_found_cost"], 2)
            items.append(usage)
            subtotal = round(subtotal + 0, 2)  # already accumulated above

        subtotal = round(sum(i["total_cost"] for i in items), 2)
        gst_amount = round(subtotal * gst_percentage / 100, 2)
        grand_total = round(subtotal + gst_amount, 2)

        # Generate invoice number
        import secrets
        inv_number = f"INV-{month}-{secrets.token_hex(4)}"

        invoice_doc = {
            "invoice_number": inv_number,
            "client_id": _oid(client_id),
            "client_name": client["username"],
            "company_name": client["company_name"],
            "invoice_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),

            "billing_period_start": start_dt.strftime("%Y-%m-%d"),
            "billing_period_end": end_dt.strftime("%Y-%m-%d"),
            "api_wise_usage": items,
            "subtotal": subtotal,
            "gst_percentage": gst_percentage,
            "gst_amount": gst_amount,
            "grand_total": grand_total,
            "currency": currency,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
        }

        result = await db["invoices"].insert_one(invoice_doc)

        # Update usage_reports to mark them as invoiced
        await db["usage_reports"].update_many(
            {"client_id": _oid(client_id), "created_at": {"$gte": start_dt, "$lte": end_dt}},
            {"$set": {"invoice_status": "generated"}}
        )

        # Audit log
        await db["audit_logs"].insert_one({
            "admin_username": "admin",
            "action": "Invoice Generated",
            "details": f"Generated invoice {inv_number} for client {client['company_name']} (month: {month}).",
            "timestamp": datetime.now(timezone.utc),
        })

        return {
            "id": str(result.inserted_id),
            "invoice_number": inv_number,
            "client_id": str(client_id),
            "company_name": client["company_name"],
            "invoice_date": invoice_doc["invoice_date"],
            "billing_period_start": invoice_doc["billing_period_start"],
            "billing_period_end": invoice_doc["billing_period_end"],
            "api_wise_usage": items,
            "subtotal": subtotal,
            "gst_percentage": gst_percentage,
            "gst_amount": gst_amount,
            "grand_total": grand_total,
            "currency": currency,
            "status": "pending",
            "created_at": invoice_doc["created_at"].isoformat(),
        }

    # ------------------------------------------------------------------
    # Invoice listing
    # ------------------------------------------------------------------

    async def get_invoices(self, db, client_id: Optional[str] = None,
                            status: Optional[str] = None,
                            limit: int = 50):
        """Return a list of invoices, optionally filtered."""
        query = {}
        if client_id:
            query["client_id"] = _oid(client_id)
        if status:
            query["status"] = status

        cursor = db["invoices"].find(query).sort("created_at", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        total = await db["invoices"].count_documents(query)

        invoices = []
        for d in docs:
            invoice = {
                "id": str(d["_id"]),
                "invoice_number": d["invoice_number"],
                "client_id": str(d["client_id"]),
                "client_name": d.get("client_name", ""),
                "company_name": d.get("company_name", ""),
                "invoice_date": d.get("invoice_date", ""),
                "billing_period_start": d.get("billing_period_start", ""),
                "billing_period_end": d.get("billing_period_end", ""),
                "api_wise_usage": d.get("api_wise_usage", []),
                "subtotal": d.get("subtotal", 0),
                "gst_percentage": d.get("gst_percentage", 18),
                "gst_amount": d.get("gst_amount", 0),
                "grand_total": d.get("grand_total", 0),
                "currency": d.get("currency", "INR"),
                "status": d.get("status", "pending"),
                "created_at": d.get("created_at", datetime.now(timezone.utc)).isoformat() if isinstance(d.get("created_at"), datetime) else d.get("created_at", ""),
            }
            invoices.append(invoice)

        return {"data": invoices, "total": total}

    # ------------------------------------------------------------------
    # Report export
    # ------------------------------------------------------------------

    async def export_report(self, db, export_format: str = "csv",
                             report_type: str = "usage",
                             status: Optional[str] = None,
                             api_name: Optional[str] = None,
                             client_name: Optional[str] = None,
                             start_date: Optional[str] = None,
                             end_date: Optional[str] = None):
        """
        Generate an export file (CSV or Excel) for a report.

        Returns a dict with 'content' (base64-encoded file data) and
        'filename' for the frontend to download.
        """

        # Fetch the underlying data based on report_type
        if report_type in ("usage", "daily"):
            table = await self.get_report_table_data(
                db, status=status, api_name=api_name, client_name=client_name,
                start_date=start_date, end_date=end_date
            )
            rows = table["data"]
            headers = ["Date", "Client", "API", "Success", "Failed", "Not Found", "Total", "Cost"]
        elif report_type == "invoice":
            invoices = await self.get_invoices(db)
            rows = invoices["data"]
            headers = ["Invoice #", "Client", "Date", "Period", "Total", "Status"]
        elif report_type == "monthly":
            daily = await self.get_daily_usage_report(db, start_date=start_date, time_filter="month")
            rows = daily
            headers = ["Date", "Total", "Success", "Failed", "Not Found", "Cost"]
        else:
            rows = []
            headers = []

        table_rows = []
        for row in rows:
            if isinstance(row, dict):
                if report_type == "invoice":
                    table_rows.append([
                        row.get("invoice_number", ""),
                        row.get("company_name", ""),
                        row.get("invoice_date", ""),
                        f"{row.get('billing_period_start','')} to {row.get('billing_period_end','')}",
                        f"{row.get('grand_total', 0):.2f}",
                        row.get("status", ""),
                    ])
                elif report_type == "monthly":
                    table_rows.append([
                        row.get("date", ""),
                        row.get("total_requests", 0),
                        row.get("success_requests", 0),
                        row.get("failed_requests", 0),
                        row.get("not_found_requests", 0),
                        f"{row.get('cost', 0):.2f}",
                    ])
                else:
                    table_rows.append([
                        row.get("date", ""),
                        row.get("client_name", ""),
                        row.get("api_name", ""),
                        row.get("success", 0),
                        row.get("failed", 0),
                        row.get("not_found", 0),
                        row.get("total_requests", 0),
                        f"{row.get('total_cost', 0):.2f}",
                    ])

        now = datetime.now(timezone.utc)
        filename_stem = f"report-{report_type}-{now.strftime('%Y%m%d_%H%M%S')}"
        from app.utils.export_helpers import encode_tabular_export
        return encode_tabular_export(headers, table_rows, export_format, filename_stem)
