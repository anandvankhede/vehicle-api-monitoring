"""
Dashboard Analytics Service
============================

Reads raw API responses from the response database and aggregates them
for the admin dashboard. The dashboard NEVER receives raw documents — only
aggregated counts/graph points.

Flow for a selected client + API:
    username/client_id
        -> user_mapping (client_id, access_key, apis[])
        -> api_name -> result_{api_name} response_db collection (discovered live)
        -> query { access_key, created_time range }
        -> read response.response_code (and fallbacks)
        -> aggregate

Status classification (verified against live response DB data):
    response.response_code 101 -> SUCCESS   (data found)
    response.response_code 103 -> NOT_FOUND (no data found)
    response.response_code 110 -> FAILED    (processing/upstream error)
    fallback fields: response.responseStatus, response.result, response.success

Only projected fields are read from response documents:
    access_key, created_time, response.response_code, response.responseStatus
Raw request/vehicle/owner data is never loaded for analytics.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple

from bson import ObjectId

from app.database import db_manager
from app.utils.dashboard_time import (
    fmt_created_time,
    now_dashboard,
    parse_created_bound,
    to_dashboard_naive,
)
from app.services.api_collections import (
    get_response_collection_for_api,
    get_live_response_api_names,
    get_catalog_api_names,
    is_catalog_api_name,
    is_live_response_db_api,
    is_valid_api_name,
    is_registered_api_name,
)
from app.services.response_db_guard import (
    response_db_aggregate,
    response_db_count_documents,
    response_db_find_to_list,
)

# -----------------------------------------------------------------------------
# Response status normalization
# -----------------------------------------------------------------------------

# Client access keys on the response DB:
#   101 -> SUCCESS | 103 -> NOT_FOUND | 110 -> FAILED
_CODE_TO_STATUS = {101: "SUCCESS", 103: "NOT_FOUND", 110: "FAILED"}

_SUCC_TOKENS = {"success", "ok", "found", "200", "101"}
_NF_TOKENS = {"not_found", "notfound", "data not found", "no data", "103"}
_FAIL_TOKENS = {"failed", "fail", "failure", "error", "110"}


def normalize_response_status(response):
    """
    Determine the business status of a single response object.

    Returns one of: 'SUCCESS' | 'NOT_FOUND' | 'FAILED' | 'OTHER'.
    Unknown statuses are never forced into SUCCESS.
    """
    if not isinstance(response, dict):
        return "OTHER"

    # Primary: response_code (reliable across all seven collections)
    code = response.get("response_code")
    if code is not None:
        try:
            status = _CODE_TO_STATUS.get(int(code))
            if status:
                return status
        except (TypeError, ValueError):
            pass

    # Fallback: responseStatus
    rs = str(response.get("responseStatus", "")).strip().lower()
    if rs == "success":
        return "SUCCESS"
    if rs in ("error", "failed"):
        return "FAILED"

    # Fallback: result (string form)
    res = response.get("result")
    if isinstance(res, str):
        rl = res.strip().lower()
        if rl in _SUCC_TOKENS:
            return "SUCCESS"
        if rl in _NF_TOKENS:
            return "NOT_FOUND"
        if rl in _FAIL_TOKENS:
            return "FAILED"

    # Fallback: success boolean (rc_to_mobile style)
    success = response.get("success")
    if isinstance(success, bool):
        return "SUCCESS" if success else "FAILED"

    return "OTHER"


def _classify_code(code) -> str:
    """Map a raw response_code value to a status bucket."""
    code = str(code).strip()
    if code in ("101", "200"):
        return "SUCCESS"
    if code == "103":
        return "NOT_FOUND"
    if code == "110":
        return "FAILED"
    return "OTHER"


# -----------------------------------------------------------------------------
# user_mapping lookups
# -----------------------------------------------------------------------------

async def resolve_api_names_for_scope(
    db, client_id: str = "all", response_db=None,
) -> List[str]:
    """
    APIs available for dashboard / detailed chart for the selected scope.

    - all users  -> live response_db collections (result_*)
    - one client -> catalog-assigned APIs for that client
    """
    scope = await resolve_query_scope(db, client_id, response_db=response_db)
    return scope["api_names"]


async def _resolve_client_mapping(db, client_id: str):
    """Return user_mapping for a client, syncing from source collections if needed."""
    mapping = await get_user_mapping_by_client_id(db, client_id)
    if mapping:
        return mapping
    try:
        oid = ObjectId(client_id)
    except Exception:
        return None
    client = await db["clients"].find_one({"_id": oid})
    if not client:
        return None
    from app.services.user_mapping_service import sync_user_mapping
    await sync_user_mapping(db, oid)
    return await get_user_mapping_by_client_id(db, client_id)


async def resolve_query_scope(
    db, client_id: str = "all", response_db=None,
) -> Dict[str, Any]:
    """
    Resolve response_db query scope for dashboard and detailed chart analytics.

    Dashboard views discover APIs from the response database when showing all
    clients. Client-specific views use catalog-assigned APIs from user_mapping.

    Returns:
        api_names:   API names to query
        key_scope:   access_key filter (None = global response_db query)
        client_name: display label
        client_id:   normalized client id string
    """
    is_all = client_id in ("all", None, "")
    if is_all:
        return {
            "api_names": await get_live_response_api_names(response_db),
            "key_scope": None,
            "client_name": "All Clients",
            "client_id": "all",
        }

    mapping = await _resolve_client_mapping(db, client_id)
    if not mapping:
        return {
            "api_names": [],
            "key_scope": None,
            "client_name": "Unknown",
            "client_id": client_id,
        }

    catalog_names = set(await get_catalog_api_names(db))
    client = await db["clients"].find_one({"_id": mapping.get("client_id")})
    assigned = [
        n for n in (mapping.get("apis") or [])
        if n in catalog_names and is_catalog_api_name(n)
    ]
    access_key = mapping.get("access_key") or None
    return {
        "api_names": sorted(assigned),
        "key_scope": access_key,
        "client_name": (client or {}).get(
            "company_name", mapping.get("company_name", "Unknown")
        ),
        "client_id": client_id,
    }


async def _catalog_meta_for_api(db, api_name: str) -> Dict[str, Any]:
    """Optional display metadata from the manual apis catalog."""
    doc = await db["apis"].find_one({"name": api_name})
    if not doc:
        return {"id": api_name, "category": "vehicle"}
    return {
        "id": str(doc["_id"]),
        "category": doc.get("category", "vehicle"),
    }


async def resolve_api_options_for_scope(
    db, client_id: str = "all", response_db=None,
) -> List[dict]:
    """
    Dropdown options for dashboard / detailed charts.

    All clients: APIs discovered live from response_db collections.
    One client: catalog-assigned APIs for that client.
    """
    names = await resolve_api_names_for_scope(db, client_id, response_db=response_db)
    if not names:
        return []

    api_docs = await db["apis"].find({"name": {"$in": names}}).to_list(length=None)
    name_to_api = {d.get("name"): d for d in api_docs if d.get("name")}

    options = []
    for name in names:
        doc = name_to_api.get(name)
        options.append({
            "id": str(doc["_id"]) if doc else name,
            "name": name,
            "category": (doc or {}).get("category", "vehicle"),
        })
    return options


async def _resolve_dashboard_api_name(
    db,
    api_id: Optional[str] = None,
    api_name: Optional[str] = None,
    response_db=None,
) -> Optional[str]:
    """Resolve dashboard api id/name — catalog entry or live response_db API."""
    live = set(await get_live_response_api_names(response_db))

    async def _accept(name: Optional[str]) -> Optional[str]:
        if not name or not is_catalog_api_name(name):
            return None
        if name in live:
            return name
        doc = await db["apis"].find_one({"name": name}, {"_id": 1})
        return name if doc else None

    if api_name:
        resolved = await _accept(api_name)
        if resolved:
            return resolved
    if api_id and api_id != "all":
        if await _accept(api_id):
            return api_id
        try:
            doc = await db["apis"].find_one({"_id": ObjectId(api_id)}, {"name": 1})
            if doc and doc.get("name"):
                name = doc["name"]
                if name in live or await db["apis"].find_one({"name": name}, {"_id": 1}):
                    return name
        except Exception:
            pass
        doc = await db["apis"].find_one({"name": api_id}, {"name": 1})
        if doc and doc.get("name"):
            return doc["name"]
    return None


async def _resolve_api_name(
    db,
    api_id: Optional[str] = None,
    api_name: Optional[str] = None,
    response_db=None,
) -> Optional[str]:
    """Resolve catalog id or api_name to an application api_name."""
    async def _accept(name: Optional[str]) -> Optional[str]:
        if not name or not is_catalog_api_name(name):
            return None
        doc = await db["apis"].find_one({"name": name}, {"_id": 1})
        return name if doc else None

    if api_name:
        resolved = await _accept(api_name)
        if resolved:
            return resolved
    if api_id and api_id != "all":
        if await _accept(api_id):
            return api_id
        try:
            doc = await db["apis"].find_one({"_id": ObjectId(api_id)}, {"name": 1})
            if doc and doc.get("name"):
                return doc["name"]
        except Exception:
            pass
        doc = await db["apis"].find_one({"name": api_id}, {"name": 1})
        if doc and doc.get("name"):
            return doc["name"]
    return None


async def get_user_mapping_by_client_id(db, client_id: str):
    """Return the user_mapping document for a raw client_id string."""
    try:
        oid = ObjectId(client_id)
    except Exception:
        return None
    return await db["user_mapping"].find_one({"client_id": oid})


async def get_user_mapping_by_username(db, username: str):
    """Return the user_mapping document for a username."""
    return await db["user_mapping"].find_one({"username": username})


async def resolve_user_mapping(db, identifier: str):
    """
    Resolve a dashboard filter value to a user_mapping document.

    `identifier` may be a client_id string or a username. client_id is the
    authoritative relationship; username is only a display/resolution aid.
    """
    if not identifier or identifier == "all":
        return None
    mapping = await get_user_mapping_by_client_id(db, identifier)
    if not mapping:
        mapping = await get_user_mapping_by_username(db, identifier)
    return mapping


# -----------------------------------------------------------------------------
# Date range -> created_time string bounds ("YYYY-MM-DD HH:mm:ss")
# -----------------------------------------------------------------------------

def _fmt(dt: datetime) -> str:
    return fmt_created_time(dt)


def _parse_bound(value: str) -> datetime:
    return parse_created_bound(value)


def compute_created_time_range(
    time_filter: str = "last_7_days",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """
    Convert a dashboard time filter into half-open string bounds suitable for
    matching the string `created_time` field: [start, end).

    Returns (start_str, end_str) in "YYYY-MM-DD HH:mm:ss" format using the
    configured dashboard timezone (response data is stored as naive local time).
    """
    now = now_dashboard()

    if time_filter == "custom" and (start_date or end_date):
        end = _parse_bound(end_date) if end_date else to_dashboard_naive(now)
        start = _parse_bound(start_date) if start_date else (end - timedelta(days=7))
        if end.hour == 0 and end.minute == 0 and end.second == 0 and end_date and len(end_date.strip()) <= 10:
            end = end + timedelta(days=1)
        return _fmt(start), _fmt(end)

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if time_filter == "last_30_min":
        end = now.replace(second=0, microsecond=0) + timedelta(minutes=1)
        return _fmt(end - timedelta(minutes=30)), _fmt(end)
    if time_filter in (
        "last_1_hour", "last_2_hours", "last_3_hours",
        "last_4_hours", "last_5_hours",
    ):
        hours = int(time_filter.split("_")[1])
        end = now.replace(second=0, microsecond=0) + timedelta(minutes=1)
        return _fmt(end - timedelta(hours=hours)), _fmt(end)
    if time_filter == "today":
        return _fmt(today_start), _fmt(today_start + timedelta(days=1))
    if time_filter == "yesterday":
        return _fmt(today_start - timedelta(days=1)), _fmt(today_start)
    if time_filter == "last_7_days":
        return _fmt(today_start - timedelta(days=6)), _fmt(today_start + timedelta(days=1))
    if time_filter == "last_30_days":
        return _fmt(today_start - timedelta(days=29)), _fmt(today_start + timedelta(days=1))
    if time_filter == "last_month":
        return _fmt(today_start - timedelta(days=29)), _fmt(today_start + timedelta(days=1))
    if time_filter == "this_month":
        return _fmt(today_start.replace(day=1)), _fmt(
            (today_start.replace(day=28) + timedelta(days=4)).replace(day=1))
    return _fmt(today_start - timedelta(days=6)), _fmt(today_start + timedelta(days=1))



# -----------------------------------------------------------------------------
# Aggregation against the response collections
# -----------------------------------------------------------------------------

def _status_map_from_groups(groups) -> Dict[str, int]:
    """Normalize an aggregate group-by-response_code result into counters."""
    counts: Dict[str, int] = {}
    for g in groups:
        status = _classify_code(g["_id"])
        counts[status] = counts.get(status, 0) + g["count"]
    return counts


def _projection() -> dict:
    """Only the fields the dashboard needs are read from response documents."""
    return {
        "access_key": 1,
        "created_time": 1,
        "response.response_code": 1,
        "response.responseStatus": 1,
    }


async def get_usage_summary(
    response_db, access_key: str, assigned_apis: List[str],
    api_name: str = "all", time_filter: str = "last_7_days",
    start_date: Optional[str] = None, end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Aggregate total/success/not_found/failed across the allowed collections for
    a single client access_key.

    api_name may be a specific API or "all" (queries every assigned API).
    """
    start_str, end_str = compute_created_time_range(
        time_filter, start_date, end_date)
    match = {
        "access_key": access_key,
        "created_time": {"$gte": start_str, "$lt": end_str},
    }

    if api_name == "all":
        names = assigned_apis
    else:
        if api_name not in assigned_apis:
            return {"total_hits": 0, "success": 0, "not_found": 0,
                    "failed": 0, "other": 0}
        names = [api_name]

    totals = {"SUCCESS": 0, "NOT_FOUND": 0, "FAILED": 0, "OTHER": 0}

    from app.services.api_collections import get_response_collection_for_api

    async def _query(name: str) -> Dict[str, int]:
        coll = get_response_collection_for_api(name)
        if not coll:
            return {}
        pipeline = [
            {"$match": match},
            {"$group": {"_id": "$response.response_code",
                        "count": {"$sum": 1}}},
        ]
        try:
            groups = await response_db_aggregate(response_db[coll], pipeline)
        except Exception:
            return {}
        return _status_map_from_groups(groups)

    results = await asyncio.gather(*[_query(n) for n in names])
    for r in results:
        for status, count in r.items():
            totals[status] = totals.get(status, 0) + count

    success = totals["SUCCESS"]
    not_found = totals["NOT_FOUND"]
    failed = totals["FAILED"]
    return {
        "total_hits": success + not_found + failed + totals["OTHER"],
        "success": success,
        "not_found": not_found,
        "failed": failed,
        "other": totals["OTHER"],
    }

async def get_usage_by_date(
    response_db, access_key: str, assigned_apis: List[str],
    api_name: str = "all", time_filter: str = "last_7_days",
    start_date: Optional[str] = None, end_date: Optional[str] = None,
) -> List[dict]:
    """
    Daily graph: group by date and status for the allowed collections.

    Returns:
        [{"date": "2026-08-06", "success": 1200, "not_found": 100,
          "failed": 20, "total": 1320}, ...]
    """
    start_str, end_str = compute_created_time_range(
        time_filter, start_date, end_date)
    match = {
        "access_key": access_key,
        "created_time": {"$gte": start_str, "$lt": end_str},
    }

    if api_name == "all":
        names = assigned_apis
    else:
        if api_name not in assigned_apis:
            return []
        names = [api_name]

    from app.services.api_collections import get_response_collection_for_api

    day_map: Dict[str, Dict[str, int]] = {}

    async def _query(name: str) -> None:
        coll = get_response_collection_for_api(name)
        if not coll:
            return
        pipeline = [
            {"$match": match},
            {"$group": {
                "_id": {
                    "date": {"$substr": ["$created_time", 0, 10]},
                    "code": "$response.response_code",
                },
                "count": {"$sum": 1},
            }},
        ]
        try:
            groups = await response_db_aggregate(response_db[coll], pipeline)
        except Exception:
            return
        for g in groups:
            key = g["_id"]
            date = key.get("date", "")
            status = _classify_code(key.get("code"))
            bucket = day_map.setdefault(date, {"success": 0, "not_found": 0,
                                               "failed": 0, "other": 0})
            if status == "SUCCESS":
                bucket["success"] += g["count"]
            elif status == "NOT_FOUND":
                bucket["not_found"] += g["count"]
            elif status == "FAILED":
                bucket["failed"] += g["count"]
            else:
                bucket["other"] += g["count"]

    await asyncio.gather(*[_query(n) for n in names])

    rows = []
    for date in sorted(day_map):
        b = day_map[date]
        total = b["success"] + b["not_found"] + b["failed"] + b["other"]
        rows.append({
            "date": date,
            "success": b["success"],
            "not_found": b["not_found"],
            "failed": b["failed"],
            "other": b["other"],
            "total": total,
        })
    return rows

def _previous_range(start_str: str, end_str: str):
    """Return the equally-sized window immediately before [start, end)."""
    try:
        start_dt = datetime.strptime(
            start_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        end_dt = datetime.strptime(
            end_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return start_str, end_str
    size = end_dt - start_dt
    return _fmt(start_dt - size), _fmt(start_dt)


async def get_user_api_stats(
    response_db, db, client_id: str = "all", time_filter: str = "last_7_days",
    start_date: Optional[str] = None, end_date: Optional[str] = None,
) -> List[dict]:
    """
    Per-API KPI grid for the selected scope, aggregated from the response
    (response) collections — never from raw documents.

    Two branches (dynamic):
        * ALL USERS (client_id == "all"):
            Query every known response collection directly. No access key and
            no user_mapping are involved — just count response.response_code:
                101 -> Success, 103 -> Data Not Found, 110 -> Error; total = total requests.
        * SPECIFIC USER (client_id given):
            user_mapping -> access_key + apis[] -> each api_name -> its response
            collection, filtered by that user's access key.

    Each API issues ONE aggregate call that computes both the current and the
    previous window in a single $facet pipeline (real-data trend).

    Returns camelCase records consumed by the dashboard KPI grid:
        {id, name, category, totalHits, success, notFound, failed,
         status, trendPercentage, trendDirection, avgResponseTimeMs}
    """
    if not db_manager.response_db_ready:
        return []

    # The frontend sends 'last_month'; the range helper uses 'last_30_days'.
    if time_filter == "last_month":
        time_filter = "last_30_days"

    # API catalog (display id + category).
    api_docs = await db["apis"].find().to_list(length=None)
    name_to_api = {d.get("name"): d for d in api_docs if d.get("name")}

    # Time bounds (current + previous window for trend).
    start_str, end_str = compute_created_time_range(
        time_filter, start_date, end_date)
    prev_start, prev_end = _previous_range(start_str, end_str)

    scope = await resolve_query_scope(db, client_id, response_db=response_db)
    names = scope["api_names"]
    key_scope = scope["key_scope"]

    if not names:
        return []

    # --- Aggregate per API (current + previous in one query) ---
    async def _query(name: str) -> Dict[str, Any]:
        coll = get_response_collection_for_api(name)
        if not coll:
            return {"api_name": name, "current": {}, "previous": {}}
        facet = {
            "current": [
                {"$match": {"created_time": {"$gte": start_str, "$lt": end_str}}},
                {"$group": {"_id": "$response.response_code", "count": {"$sum": 1}}},
            ],
            "previous": [
                {"$match": {"created_time": {"$gte": prev_start, "$lt": prev_end}}},
                {"$group": {"_id": "$response.response_code", "count": {"$sum": 1}}},
            ],
            "avg_time": [
                {"$match": {"created_time": {"$gte": start_str, "$lt": end_str}}},
                {"$group": {"_id": None, "avg": {"$avg": "$response_time"}}},
            ],
        }
        pipeline = []
        if key_scope:
            pipeline.append({"$match": {"access_key": key_scope}})
        pipeline.append({"$facet": facet})
        try:
            docs = await response_db_aggregate(response_db[coll], pipeline)
        except Exception:
            return {"api_name": name, "current": {}, "previous": {}, "avg_time": []}
        d = docs[0] if docs else {}
        return {
            "api_name": name,
            "current": _status_map_from_groups(d.get("current", [])),
            "previous": _status_map_from_groups(d.get("previous", [])),
            "avg_time": d.get("avg_time", []),
        }

    gathered = await asyncio.gather(*[_query(n) for n in names])

    # --- Build the KPI records ---
    results: List[dict] = []
    for r in gathered:
        name = r["api_name"]
        cur, prev = r["current"], r["previous"]
        success = cur.get("SUCCESS", 0)
        not_found = cur.get("NOT_FOUND", 0)
        failed = cur.get("FAILED", 0)
        other = cur.get("OTHER", 0)
        total = success + not_found + failed + other
        prev_total = (prev.get("SUCCESS", 0) + prev.get("NOT_FOUND", 0)
                      + prev.get("FAILED", 0) + prev.get("OTHER", 0))

        if total == 0:
            status = "no_data"
        elif (success / total * 100) >= 95:
            status = "healthy"
        elif (success / total * 100) >= 80:
            status = "degraded"
        else:
            status = "down"

        if prev_total > 0:
            pct = round((total - prev_total) / prev_total * 100, 1)
            direction = "up" if pct > 0 else ("down" if pct < 0 else "stable")
            shown = abs(pct)
        elif total > 0:
            direction, shown = "up", 100.0
        else:
            direction, shown = "stable", 0.0

        api_doc = name_to_api.get(name, {})
        avg_grp = r.get("avg_time") or []
        avg_rt = avg_grp[0].get("avg") if avg_grp else None
        results.append({
            "id": str(api_doc.get("_id") or "") or name,
            "name": name,
            "category": api_doc.get("category", "vehicle"),
            "totalHits": total,
            "success": success,
            "notFound": not_found,
            "failed": failed,
            "status": status,
            "trendPercentage": shown,
            "trendDirection": direction,
            "avgResponseTimeMs": int(round(avg_rt)) if avg_rt else 0,
        })
    return results

# -----------------------------------------------------------------------------
# Global API monitoring (Main API Monitoring pie + line charts)
# -----------------------------------------------------------------------------

def _trend_step(time_filter: str) -> Optional[timedelta]:
    """
    Bucket width for short-range trend charts (~15 points per window).
    Industry-style fixed intervals: 2m / 4m / 8m / 12m / 16m / 20m.
    """
    return {
        "last_30_min": timedelta(minutes=2),
        "last_1_hour": timedelta(minutes=4),
        "last_2_hours": timedelta(minutes=8),
        "last_3_hours": timedelta(minutes=12),
        "last_4_hours": timedelta(minutes=16),
        "last_5_hours": timedelta(minutes=20),
        "today": timedelta(hours=1),
        "yesterday": timedelta(hours=1),
    }.get(time_filter)


def _mongodb_substr_len(time_filter: str) -> int:
    """Raw aggregation granularity before merging into display buckets."""
    step = _trend_step(time_filter)
    if step is None:
        return 10
    if step < timedelta(hours=1):
        return 16
    return 13


def _trend_bucket_filter(time_filter: str):
    """Backward-compatible helper returning (substr_len, format_hint)."""
    return _mongodb_substr_len(time_filter), ""


def _parse_raw_bucket(bucket: str) -> Optional[datetime]:
    if len(bucket) >= 16:
        try:
            return datetime.strptime(bucket[:16], "%Y-%m-%d %H:%M")
        except ValueError:
            return None
    if len(bucket) >= 13:
        try:
            return datetime.strptime(bucket[:13] + ":00", "%Y-%m-%d %H:%M")
        except ValueError:
            return None
    if len(bucket) >= 10:
        try:
            return datetime.strptime(bucket[:10], "%Y-%m-%d")
        except ValueError:
            return None
    return None


def _floor_dt(dt: datetime, step: timedelta) -> datetime:
    if step >= timedelta(days=1):
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)
    if step >= timedelta(hours=1):
        return dt.replace(minute=0, second=0, microsecond=0)
    step_minutes = max(1, int(step.total_seconds() // 60))
    minute = (dt.minute // step_minutes) * step_minutes
    return dt.replace(minute=minute, second=0, microsecond=0)


def _bucket_key_from_dt(dt: datetime, time_filter: str) -> str:
    step = _trend_step(time_filter)
    if step is None:
        return dt.strftime("%Y-%m-%d")
    floored = _floor_dt(dt, step)
    if step >= timedelta(hours=1):
        return floored.strftime("%Y-%m-%d %H")
    return floored.strftime("%Y-%m-%d %H:%M")


def _merge_trend_map(
    trend_map: Dict[str, Dict[str, int]], time_filter: str,
) -> Dict[str, Dict[str, int]]:
    step = _trend_step(time_filter)
    if step is None:
        return trend_map
    if step >= timedelta(hours=1):
        return trend_map
    merged: Dict[str, Dict[str, int]] = {}
    empty = {"success": 0, "not_found": 0, "failed": 0, "other": 0}
    for bucket, counts in trend_map.items():
        dt = _parse_raw_bucket(bucket)
        if not dt:
            continue
        key = _bucket_key_from_dt(_floor_dt(dt, step), time_filter)
        target = merged.setdefault(key, dict(empty))
        for field in ("success", "not_found", "failed", "other"):
            target[field] += counts.get(field, 0)
    return merged


def _build_trend_series(
    trend_map_raw: Dict[str, Dict[str, int]],
    start_str: str,
    end_str: str,
    time_filter: str,
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    trend_map = _merge_trend_map(trend_map_raw, time_filter)
    totals = {"SUCCESS": 0, "NOT_FOUND": 0, "FAILED": 0, "OTHER": 0}
    trend_data: List[Dict[str, Any]] = []
    empty_bucket = {"success": 0, "not_found": 0, "failed": 0, "other": 0}
    for bucket in _generate_bucket_keys(start_str, end_str, time_filter):
        b = trend_map.get(bucket, empty_bucket)
        btotal = b["success"] + b["not_found"] + b["failed"] + b["other"]
        totals["SUCCESS"] += b["success"]
        totals["NOT_FOUND"] += b["not_found"]
        totals["FAILED"] += b["failed"]
        totals["OTHER"] += b["other"]
        trend_data.append({
            "time": _trend_bucket_label(bucket, time_filter),
            "total": btotal,
            "success": b["success"],
            "failed": b["failed"],
            "notFound": b["not_found"],
        })
    return trend_data, totals

def _generate_bucket_keys(start_str: str, end_str: str, time_filter: str):
    """
    Build a complete, chronological list of bucket keys that cover the whole
    [start, end) window at the granularity chosen for the filter.
    """
    fmt_full = "%Y-%m-%d %H:%M:%S"
    try:
        start_dt = datetime.strptime(start_str, fmt_full)
        end_dt = datetime.strptime(end_str, fmt_full)
    except ValueError:
        return []

    step = _trend_step(time_filter)
    now_local = to_dashboard_naive(now_dashboard())

    if step is None:
        cap = min(
            end_dt,
            now_local.replace(hour=0, minute=0, second=0, microsecond=0)
            + timedelta(days=1),
        )
        cur = start_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        day_step = timedelta(days=1)
        keys = []
        while cur < cap:
            keys.append(cur.strftime("%Y-%m-%d"))
            cur += day_step
        return keys

    if step >= timedelta(hours=1):
        cap = min(
            end_dt,
            now_local.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1),
        )
        cur = start_dt.replace(minute=0, second=0, microsecond=0)
    else:
        cap = min(
            end_dt,
            now_local.replace(second=0, microsecond=0) + timedelta(minutes=1),
        )
        cur = _floor_dt(start_dt, step)

    keys = []
    while cur < cap:
        keys.append(_bucket_key_from_dt(cur, time_filter))
        cur += step
    return keys




def _trend_bucket_label(bucket: str, time_filter: str) -> str:
    """Convert a bucket key into a compact chart label."""
    step = _trend_step(time_filter)
    if step is None and len(bucket) >= 10:
        return bucket[5:]
    if step and step >= timedelta(hours=1) and len(bucket) >= 13:
        return f"{bucket[11:]}:00"
    if len(bucket) >= 16:
        return bucket[11:]
    if len(bucket) >= 13:
        return f"{bucket[11:]}:00"
    if len(bucket) >= 10:
        return bucket[5:]
    return bucket






async def get_api_usage_stats(
    response_db, db, api_id: str, time_filter: str = "last_7_days",
    start_date: Optional[str] = None, end_date: Optional[str] = None,
    client_id: str = "all",
) -> Dict[str, Any]:
    """
    Global monitoring stats for a single API, aggregated from the response
    (response) collections — the same real-data source used by the KPI grid.

    The pie-chart distribution is computed from response.response_code buckets,
    and the line-chart trend is bucketed from created_time at a granularity
    that fits the selected time filter.

    Returns the camelCase shape consumed by `ApiMonitoringStats`:
        {apiId, apiName, timeFilter, distribution[], trendData[],
         totalHits, successRate, avgLatencyMs, uptimePercentage}
    """
    empty = {
        "apiId": api_id,
        "apiName": api_id,
        "timeFilter": time_filter,
        "distribution": [],
        "trendData": [],
        "totalHits": 0,
        "successRate": 0,
        "avgLatencyMs": 0,
        "uptimePercentage": 0,
    }
    if not db_manager.response_db_ready:
        return empty

    api_name = await _resolve_dashboard_api_name(db, api_id, response_db=response_db)
    if not api_name:
        raise ValueError("API not found")

    key_scope = None
    if client_id not in ("all", None, ""):
        mapping = await _resolve_client_mapping(db, client_id)
        if not mapping:
            raise ValueError("Client not found")
        assigned = mapping.get("apis") or []
        if api_name not in assigned:
            raise ValueError("API not assigned to this client")
        key_scope = mapping.get("access_key") or None

    coll = get_response_collection_for_api(api_name)
    if not coll:
        return {
            "apiId": api_id,
            "apiName": api_name,
            "timeFilter": time_filter,
            "distribution": [],
            "trendData": [],
            "totalHits": 0,
            "successRate": 0,
            "avgLatencyMs": 0,
            "uptimePercentage": 0,
        }

    start_str, end_str = compute_created_time_range(
        time_filter, start_date, end_date)
    sub_len = _mongodb_substr_len(time_filter)

    match_stage: Dict[str, Any] = {
        "created_time": {"$gte": start_str, "$lt": end_str},
    }
    if key_scope:
        match_stage["access_key"] = key_scope

    pipeline = [
        {"$match": match_stage},
        {"$facet": {
            "buckets": [
                {"$group": {
                    "_id": {
                        "bucket": {"$substr": ["$created_time", 0, sub_len]},
                        "code": "$response.response_code",
                    },
                    "count": {"$sum": 1},
                }},
            ],
            "avg_time": [
                {"$group": {"_id": None, "avg": {"$avg": "$response_time"}}},
            ],
        }},
    ]
    try:
        docs = await response_db_aggregate(response_db[coll], pipeline)
    except Exception:
        docs = []
    d = docs[0] if docs else {}

    # --- Trend buckets ---
    trend_map: Dict[str, Dict[str, int]] = {}
    for g in d.get("buckets", []):
        key = g["_id"]
        bucket = key.get("bucket", "")
        status = _classify_code(key.get("code"))
        b = trend_map.setdefault(
            bucket, {"success": 0, "not_found": 0, "failed": 0, "other": 0})
        if status == "SUCCESS":
            b["success"] += g["count"]
        elif status == "NOT_FOUND":
            b["not_found"] += g["count"]
        elif status == "FAILED":
            b["failed"] += g["count"]
        else:
            b["other"] += g["count"]

    totals = {"SUCCESS": 0, "NOT_FOUND": 0, "FAILED": 0, "OTHER": 0}
    trend_data, totals = _build_trend_series(
        trend_map, start_str, end_str, time_filter)

    success = totals["SUCCESS"]
    not_found = totals["NOT_FOUND"]
    failed = totals["FAILED"]
    other = totals["OTHER"]
    total = success + not_found + failed + other

    def _pct(value: int) -> float:
        return round((value / total * 100), 1) if total > 0 else 0

    distribution = [
        {"name": "Success", "value": success, "color": "#10B981",
         "percentage": _pct(success)},
        {"name": "Failed", "value": failed, "color": "#EF4444",
         "percentage": _pct(failed)},
        {"name": "Not Found", "value": not_found, "color": "#F59E0B",
         "percentage": _pct(not_found)},
    ]
    if other > 0:
        distribution.append({"name": "Other", "value": other, "color": "#94A3B8",
                             "percentage": _pct(other)})

    avg_grp = d.get("avg_time") or []
    avg_rt = (avg_grp[0].get("avg")
              if avg_grp and avg_grp[0].get("avg") is not None else 0)

    meta = await _catalog_meta_for_api(db, api_name)
    return {
        "apiId": meta["id"] if meta["id"] != api_name else api_id,
        "apiName": api_name,
        "timeFilter": time_filter,
        "distribution": distribution,
        "trendData": trend_data,
        "totalHits": total,
        "successRate": round((success / total * 100) if total > 0 else 0, 1),
        "avgLatencyMs": int(round(avg_rt)) if avg_rt else 0,
        "uptimePercentage": round((success / total * 100) if total > 0 else 0, 2),
    }


# -----------------------------------------------------------------------------
# Detailed chart (per-API trends for a client or all clients)
# -----------------------------------------------------------------------------

async def get_client_details_stats(
    response_db, db, client_id: str = "all", time_filter: str = "last_7_days",
    start_date: Optional[str] = None, end_date: Optional[str] = None,
    api_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Detailed chart data: one per-API trend series (+ KPI totals) for the selected
    scope, aggregated from the response collections.

    Two branches (mirrors get_user_api_stats):
        * ALL CLIENTS (client_id == "all"):
            Query every known response collection directly (no access key).
        * SPECIFIC CLIENT:
            user_mapping -> access_key + apis[] -> each api's collection,
            filtered by that client's access key.

    Each trend series is bucketized to the selected time filter and zero-filled
    so the detailed charts render continuous lines for the full window.

    Returns:
        {clientId, clientName, timeFilter, apis: [
            {apiId, apiName, category, totalHits, success, failed, notFound,
             avgResponseTimeMs, trendData: [{time, total, success, failed, notFound}, ...]},
            ...]}
    """
    start_str, end_str = compute_created_time_range(
        time_filter, start_date, end_date)
    sub_len = _mongodb_substr_len(time_filter)

    api_docs = await db["apis"].find().to_list(length=None)
    name_to_api = {d.get("name"): d for d in api_docs if d.get("name")}

    scope = await resolve_query_scope(db, client_id, response_db=response_db)
    names = scope["api_names"]
    key_scope = scope["key_scope"]
    client_name = scope["client_name"]

    if api_id and api_id not in ("all", None, ""):
        resolved_api = await _resolve_api_name(db, api_id, response_db=response_db)
        if resolved_api and resolved_api in names:
            names = [resolved_api]
        else:
            names = []

    if client_id not in ("all", None, "") and client_name == "Unknown":
        raise ValueError("Client not found")

    async def _query(name: str) -> Dict[str, Any]:
        coll = get_response_collection_for_api(name)
        if not coll:
            return {"name": name, "buckets": [], "avg_time": []}
        match: Dict[str, Any] = {
            "created_time": {"$gte": start_str, "$lt": end_str},
        }
        if key_scope:
            match["access_key"] = key_scope
        pipeline = [
            {"$match": match},
            {"$facet": {
                "buckets": [
                    {"$group": {
                        "_id": {
                            "bucket": {"$substr": ["$created_time", 0, sub_len]},
                            "code": "$response.response_code",
                        },
                        "count": {"$sum": 1},
                    }},
                ],
                "avg_time": [
                    {"$group": {"_id": None, "avg": {"$avg": "$response_time"}}},
                ],
            }},
        ]
        try:
            docs = await response_db_aggregate(response_db[coll], pipeline)
        except Exception:
            return {"name": name, "buckets": [], "avg_time": []}
        d = docs[0] if docs else {}
        return {
            "name": name,
            "buckets": d.get("buckets", []),
            "avg_time": d.get("avg_time", []),
        }

    gathered = await asyncio.gather(*[_query(n) for n in names])

    apis_data = []
    empty_bucket = {"success": 0, "not_found": 0, "failed": 0, "other": 0}
    for g in gathered:
        name = g["name"]

        # Accumulate per-bucket status counters from the raw aggregate groups.
        trend_map: Dict[str, Dict[str, int]] = {}
        for gi in g["buckets"]:
            key = gi["_id"]
            bucket = key.get("bucket", "")
            status = _classify_code(key.get("code"))
            b = trend_map.setdefault(
                bucket, {"success": 0, "not_found": 0, "failed": 0, "other": 0})
            if status == "SUCCESS":
                b["success"] += gi["count"]
            elif status == "NOT_FOUND":
                b["not_found"] += gi["count"]
            elif status == "FAILED":
                b["failed"] += gi["count"]
            else:
                b["other"] += gi["count"]

        # Zero-fill the full window so the line is continuous per filter.
        trend_data, bucket_totals = _build_trend_series(
            trend_map, start_str, end_str, time_filter)
        success = bucket_totals["SUCCESS"]
        not_found = bucket_totals["NOT_FOUND"]
        failed = bucket_totals["FAILED"]
        other = bucket_totals["OTHER"]

        avg_grp = g.get("avg_time") or []
        avg_rt = (avg_grp[0].get("avg")
                  if avg_grp and avg_grp[0].get("avg") is not None else 0)

        api_doc = name_to_api.get(name, {})
        apis_data.append({
            "apiId": str(api_doc.get("_id") or "") or name,
            "apiName": name,
            "category": api_doc.get("category", "vehicle"),
            "totalHits": success + not_found + failed + other,
            "success": success,
            "failed": failed,
            "notFound": not_found,
            "avgResponseTimeMs": int(round(avg_rt)) if avg_rt else 0,
            "trendData": trend_data,
        })

    return {
        "clientId": client_id,
        "clientName": client_name,
        "timeFilter": time_filter,
        "apis": apis_data,
    }


# -----------------------------------------------------------------------------
# Client Analytics (filtered table + summary)
# -----------------------------------------------------------------------------

# camelCase (frontend) -> snake_case key used in the analytics record.
_CLIENT_ANALYTICS_SORT_MAP = {
    "totalHits": "total_hits",
    "successRate": "success_rate",
    "avgResponseTimeMs": "avg_response_time_ms",
    "clientName": "client_name",
    "apiName": "api_name",
    "notFound": "not_found",
    "failed": "failed",
    "success": "success",
}


async def _analytics_mappings_for_scope(db, client_id: str) -> List[dict]:
    """Resolve user_mapping rows for client analytics, syncing from source when needed."""
    if client_id not in ("all", None, ""):
        mapping = await _resolve_client_mapping(db, client_id)
        return [mapping] if mapping else []

    clients = await db["clients"].find({"status": "Active"}).to_list(length=None)
    mappings: List[dict] = []
    for client in clients:
        mapping = await _resolve_client_mapping(db, str(client["_id"]))
        if mapping:
            mappings.append(mapping)
    return mappings


def _zero_analytics_rows(
    mapping: dict, names: List[str], name_to_api: Dict[str, dict],
) -> List[dict]:
    """Placeholder rows when a client has assigned APIs but no access key yet."""
    cid = mapping.get("client_id")
    client_name = mapping.get("company_name", "Unknown")
    client_code = str(mapping.get("username", "")).upper().replace("_", "-")
    now = datetime.now(timezone.utc)
    rows = []
    for name in names:
        api_doc = name_to_api.get(name, {})
        rows.append({
            "id": f"{cid}_{name}",
            "client_id": str(cid) if cid else "",
            "client_name": client_name,
            "client_code": client_code,
            "api_id": str(api_doc.get("_id") or name),
            "api_name": name,
            "api_category": api_doc.get("category", "vehicle"),
            "total_hits": 0,
            "success": 0,
            "failed": 0,
            "not_found": 0,
            "avg_response_time_ms": 0,
            "success_rate": 0,
            "timestamp": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
        })
    return rows


async def get_client_analytics_stats(
    response_db, db, client_id: str = "all", api_id: str = "all",
    time_filter: str = "today", status_filter: str = "all",
    search_query: str = "", sort_by: str = "totalHits", sort_order: str = "desc",
    start_date: Optional[str] = None, end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Per (client, api) analytics rows aggregated from the response
    collections, with client/API filtering, status filter, search and sort."""
    start_str, end_str = compute_created_time_range(
        time_filter, start_date, end_date)

    # Resolve the optional API filter to an application api_name.
    api_name_filter = None
    if api_id and api_id != "all":
        api_name_filter = await _resolve_api_name(db, api_id, response_db=response_db)

    api_docs = await db["apis"].find().to_list(length=None)
    name_to_api = {d.get("name"): d for d in api_docs if d.get("name")}

    # Scope: which clients (and which api names per client) to query.
    mappings = await _analytics_mappings_for_scope(db, client_id)

    async def _counts_for_client(mapping: dict, names: List[str]) -> List[dict]:
        access_key = mapping.get("access_key")
        if not access_key:
            return []
        cid = mapping.get("client_id")
        client = None
        if cid is not None:
            try:
                client = await db["clients"].find_one({"_id": cid})
            except Exception:
                client = None
        client_name = (client or {}).get(
            "company_name", mapping.get("company_name", "Unknown"))
        client_code = str(
            (client or {}).get("username", mapping.get("username", ""))
        ).upper().replace("_", "-")

        async def _query(name: str) -> dict:
            coll = get_response_collection_for_api(name)
            if not coll:
                return {"name": name, "counts": {}, "avg": None}
            match: Dict[str, Any] = {
                "created_time": {"$gte": start_str, "$lt": end_str},
                "access_key": access_key,
            }
            pipeline = [
                {"$match": match},
                {"$facet": {
                    "counts": [
                        {"$group": {
                            "_id": "$response.response_code",
                            "count": {"$sum": 1}}},
                    ],
                    "avg_time": [
                        {"$group": {"_id": None, "avg": {"$avg": "$response_time"}}},
                    ],
                }},
            ]
            try:
                docs = await response_db_aggregate(response_db[coll], pipeline)
            except Exception:
                return {"name": name, "counts": {}, "avg": None}
            d = docs[0] if docs else {}
            counts = _status_map_from_groups(d.get("counts", []))
            avg_grp = d.get("avg_time") or []
            avg_rt = (avg_grp[0].get("avg")
                      if avg_grp and avg_grp[0].get("avg") is not None else None)
            return {"name": name, "counts": counts, "avg": avg_rt}

        results = await asyncio.gather(*[_query(n) for n in names])
        rows = []
        for r in results:
            name = r["name"]
            success = r["counts"].get("SUCCESS", 0)
            not_found = r["counts"].get("NOT_FOUND", 0)
            failed = r["counts"].get("FAILED", 0)
            other = r["counts"].get("OTHER", 0)
            total = success + not_found + failed + other
            avg = r["avg"] or 0
            api_doc = name_to_api.get(name, {})
            rate = round((success / total * 100) if total > 0 else 0, 1)
            rows.append({
                "id": f"{cid}_{name}",
                "client_id": str(cid) if cid else "",
                "client_name": client_name,
                "client_code": client_code,
                "api_id": str(api_doc.get("_id") or name),
                "api_name": name,
                "api_category": api_doc.get("category", "vehicle"),
                "total_hits": total,
                "success": success,
                "failed": failed,
                "not_found": not_found,
                "avg_response_time_ms": int(round(avg)) if avg else 0,
                "success_rate": rate,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            })
        return rows

    # Build per (client, api) rows for the resolved scope.
    records: List[dict] = []
    catalog_names = set(await get_catalog_api_names(db))
    work_items: List[tuple] = []
    for mapping in mappings:
        if not isinstance(mapping, dict):
            continue
        assigned = mapping.get("apis") or []
        if api_name_filter:
            names = [api_name_filter] if api_name_filter in assigned else []
        else:
            names = list(assigned)
        names = [n for n in names if n in catalog_names]
        if not names:
            continue
        if not mapping.get("access_key"):
            records.extend(_zero_analytics_rows(mapping, names, name_to_api))
        else:
            work_items.append((mapping, names))

    if work_items:
        batches = await asyncio.gather(
            *[_counts_for_client(mapping, names) for mapping, names in work_items]
        )
        for batch in batches:
            records.extend(batch)

    # Free-text search across client name/code and API name.
    if search_query:
        q = search_query.lower()
        records = [r for r in records
                   if q in r["client_name"].lower()
                   or q in r["api_name"].lower()
                   or q in r["client_code"].lower()]

    # Status filter on actual response buckets.
    if status_filter != "all":
        if status_filter == "success":
            records = [r for r in records if r["success"] > 0 and r["failed"] == 0 and r["not_found"] == 0]
        elif status_filter == "failed":
            records = [r for r in records if r["failed"] > 0]
        elif status_filter == "notFound":
            records = [r for r in records if r["not_found"] > 0]

    # Sorting (translate camelCase sort key from the frontend).
    sort_key = _CLIENT_ANALYTICS_SORT_MAP.get(sort_by, "total_hits")
    records.sort(key=lambda r: r.get(sort_key, 0),
                 reverse=(sort_order != "asc"))

    now = datetime.now(timezone.utc)
    total_hits = sum(r["total_hits"] for r in records)
    success_sum = sum(r["success"] for r in records)
    overall_rate = round(
        (success_sum / total_hits * 100) if total_hits > 0 else 0, 1)
    avg_rt = int(sum(r["avg_response_time_ms"] for r in records) / len(records)) if records else 0

    return {
        "records": records,
        "summary": {
            "total_clients": len({r["client_id"] for r in records}),
            "total_apis": len({r["api_name"] for r in records}),
            "total_hits": total_hits,
            "overall_success_rate": overall_rate,
            "avg_response_time_ms": avg_rt,
        },
        "total_records": len(records),
        "filtered_records": len(records),
    }


# -----------------------------------------------------------------------------
# Client analytics — per-transaction CSV export
# -----------------------------------------------------------------------------

MAX_ANALYTICS_EXPORT_ROWS = 50_000

# Primary request identifier field per API (used for export column header/value).
API_REQUEST_FIELD_MAP = {
    "chassis_to_rc": "chassis_no",
    "chassis_to_rc_data": "chassis_no",
    "rc_data": "regn_no",
    "fastag_01": "vehicle_no",
    "fastag_02": "vehicle_no",
    "rc_to_challan": "rc_no",
    "rc_to_mobile": "rc_no",
}


def _status_code_match(status_filter: str) -> Dict[str, Any]:
    """Mongo match fragment for row-level response status filtering."""
    if status_filter == "success":
        return {"response.response_code": {"$in": [101, 200, "101", "200"]}}
    if status_filter == "failed":
        return {"response.response_code": {"$in": [110, "110"]}}
    if status_filter in ("notFound", "not_found"):
        return {"response.response_code": {"$in": [103, "103"]}}
    return {}


def _extract_request_field(request: Any, api_name: str) -> Tuple[str, str]:
    """Return (field_name, value) for the export CSV request column."""
    if not isinstance(request, dict):
        return ("request", "")
    preferred = API_REQUEST_FIELD_MAP.get(api_name)
    if preferred and request.get(preferred) is not None:
        return (preferred, str(request[preferred]))
    for key, value in request.items():
        if value is not None and isinstance(value, (str, int, float, bool)):
            return (key, str(value))
    return ("request", "")


def _extract_response_msg(response: Any) -> str:
    if not isinstance(response, dict):
        return ""
    for key in ("response_msg", "reason_msg", "message", "stautsMessage", "responseStatus"):
        val = response.get(key)
        if val is not None and str(val).strip():
            return str(val)
    return ""


def _extract_response_code(response: Any) -> str:
    if not isinstance(response, dict):
        return ""
    code = response.get("response_code")
    return "" if code is None else str(code)


async def export_client_analytics_detail(
    response_db,
    db,
    client_id: str,
    api_id: Optional[str] = None,
    api_name: Optional[str] = None,
    time_filter: str = "last_7_days",
    status_filter: str = "all",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    export_format: str = "csv",
) -> Dict[str, Any]:
    """
    Export raw response DB transaction rows for one client + API (CSV or Excel).

    Uses indexed {access_key, created_time} range scans with a tight projection
    so only export columns are read from MongoDB.
    """
    from app.utils.export_helpers import encode_tabular_export

    if not client_id or client_id == "all":
        raise ValueError("client_id is required for detail export")

    resolved_api = await _resolve_api_name(db, api_id, api_name, response_db=response_db)
    if not resolved_api:
        raise ValueError("A valid api_id or api_name is required for detail export")

    mapping = await get_user_mapping_by_client_id(db, client_id)
    if not mapping:
        raise ValueError("Client not found")

    access_key = mapping.get("access_key")
    if not access_key:
        raise ValueError("Client has no access key")

    assigned = mapping.get("apis") or []
    if assigned and resolved_api not in assigned:
        raise ValueError("API is not assigned to this client")

    coll = get_response_collection_for_api(resolved_api)
    if not coll:
        raise ValueError("Unknown API")

    start_str, end_str = compute_created_time_range(time_filter, start_date, end_date)
    match: Dict[str, Any] = {
        "access_key": access_key,
        "created_time": {"$gte": start_str, "$lt": end_str},
    }
    match.update(_status_code_match(status_filter))

    projection = {
        "_id": 0,
        "created_time": 1,
        "request": 1,
        "response.response_code": 1,
        "response.response_msg": 1,
        "response.reason_msg": 1,
        "response.message": 1,
        "response.stautsMessage": 1,
        "response.responseStatus": 1,
    }

    request_field = API_REQUEST_FIELD_MAP.get(resolved_api, "request")
    header_request = f"request.{request_field}"

    total = await response_db_count_documents(response_db[coll], match)
    truncated = total > MAX_ANALYTICS_EXPORT_ROWS

    docs = await response_db_find_to_list(
        response_db[coll],
        match,
        projection,
        sort=[("created_time", 1)],
        limit=MAX_ANALYTICS_EXPORT_ROWS,
        hint=[("access_key", 1), ("created_time", 1)],
    )
    truncated = len(docs) >= MAX_ANALYTICS_EXPORT_ROWS

    headers = [
        "created_time",
        header_request,
        "response.response_code",
        "response.response_msg",
    ]
    rows: List[List[Any]] = []
    for doc in docs:
        _, req_val = _extract_request_field(doc.get("request"), resolved_api)
        rows.append([
            doc.get("created_time", ""),
            req_val,
            _extract_response_code(doc.get("response")),
            _extract_response_msg(doc.get("response")),
        ])

    client = await db["clients"].find_one({"_id": mapping.get("client_id")})
    client_slug = (
        (client or {}).get("username")
        or mapping.get("username")
        or "client"
    )
    safe_slug = str(client_slug).lower().replace(" ", "_")
    filename_stem = (
        f"{safe_slug}_{resolved_api}_{time_filter}_"
        f"{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    )

    result = encode_tabular_export(headers, rows, export_format, filename_stem)
    result.update({
        "rowCount": len(docs),
        "totalRows": len(docs),
        "truncated": truncated,
    })
    return result


# -----------------------------------------------------------------------------
# Dashboard dropdown options (username + company + assigned APIs)
# -----------------------------------------------------------------------------

async def get_dashboard_users(db) -> List[dict]:
    """
    Return client options for the dashboard user filter.

    Includes every active client, even when API access is not assigned yet.
    """
    from app.services.dashboard_service import DashboardService
    service = DashboardService()
    options = await service.get_user_options(db)

    mapping_by_client = {}
    async for m in db["user_mapping"].find({"status": "Active"}):
        cid = m.get("client_id")
        if cid is not None:
            mapping_by_client[str(cid)] = m

    return [
        {
            "client_id": opt["id"],
            "username": opt.get("code", ""),
            "company_name": opt["name"],
            "apis": (mapping_by_client.get(opt["id"]) or {}).get("apis") or [],
        }
        for opt in options
    ]


async def get_dashboard_apis(
    db, client_id: str = "all", response_db=None,
) -> List[dict]:
    """Return API dropdown options for the selected dashboard scope."""
    return await resolve_api_options_for_scope(db, client_id, response_db=response_db)
