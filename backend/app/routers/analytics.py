"""
Dashboard Analytics Router
===========================

Admin dashboard endpoints that read aggregate usage directly from the `pan`
(API-response) database. The frontend sends only a client identifier (client_id
or username), an application `api_name`, and a date filter — the backend resolves
the access key and maps the API to its response collection.

Endpoints:
    - GET /analytics/users     — client options (client_id, username, company, apis)
    - GET /analytics/apis      — active API catalog options
    - GET /analytics/summary   — total/success/not_found/failed
    - GET /analytics/graph     — daily success/not_found/failed/total
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.database import get_database, get_pan_database
from app.dependencies.auth import get_current_admin
from app.schemas.common import ErrorResponse
from app.services import analytics_service as analytics

router = APIRouter(prefix="/analytics", tags=["Dashboard Analytics"])

VALID_TIME_FILTERS = {"today", "yesterday", "last_7_days", "last_30_days",
                      "this_month", "custom"}


@router.get("/users", responses={401: {"model": ErrorResponse}})
async def get_users(db=Depends(get_database), _=Depends(get_current_admin)):
    """Client options for the dashboard user filter."""
    return await analytics.get_dashboard_users(db)


@router.get("/apis", responses={401: {"model": ErrorResponse}})
async def get_apis(db=Depends(get_database), _=Depends(get_current_admin)):
    """Active API catalog options for the dashboard API filter."""
    return await analytics.get_dashboard_apis(db)


async def _resolve_scope(db, client_id: str, api_name: str):
    """
    Resolve the user + API query scope.

    Returns (mapping_or_none, api_name_normalized). If client_id == "all" the
    mapping is None (aggregate across all clients).
    """
    if api_name != "all" and not analytics.is_valid_api_name(api_name):
        raise HTTPException(status_code=400, detail="Unknown api_name.")
    if client_id in ("all", None, ""):
        return None, api_name
    mapping = await analytics.resolve_user_mapping(db, client_id)
    if not mapping:
        raise HTTPException(status_code=404, detail="Client not found.")
    return mapping, api_name
@router.get("/summary", responses={401: {"model": ErrorResponse}})
async def get_summary(
    client_id: str = Query("all", description="client_id or username; 'all' for all"),
    api_name: str = Query("all", description="application api_name; 'all' for all"),
    time_filter: str = Query("last_7_days"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db=Depends(get_database),
    pan_db=Depends(get_pan_database),
    _=Depends(get_current_admin),
):
    """Dashboard summary: total_hits, success, not_found, failed, other."""
    if time_filter not in VALID_TIME_FILTERS:
        time_filter = "last_7_days"
    try:
        mapping, api_name = await _resolve_scope(db, client_id, api_name)
        if mapping:
            return await analytics.get_usage_summary(
                pan_db, mapping["access_key"], mapping.get("apis", []),
                api_name, time_filter, start_date, end_date)

        # Aggregate across all active clients
        users = await analytics.get_dashboard_users(db)
        totals = {"success": 0, "not_found": 0, "failed": 0, "other": 0}
        for u in users:
            if not u.get("access_key"):
                continue
            r = await analytics.get_usage_summary(
                pan_db, u["access_key"], u.get("apis", []),
                api_name, time_filter, start_date, end_date)
            totals["success"] += r["success"]
            totals["not_found"] += r["not_found"]
            totals["failed"] += r["failed"]
            totals["other"] += r["other"]
        totals["total_hits"] = (totals["success"] + totals["not_found"]
                                + totals["failed"] + totals["other"])
        return totals
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph", responses={401: {"model": ErrorResponse}})
async def get_graph(
    client_id: str = Query("all", description="client_id or username; 'all' for all"),
    api_name: str = Query("all", description="application api_name; 'all' for all"),
    time_filter: str = Query("last_7_days"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db=Depends(get_database),
    pan_db=Depends(get_pan_database),
    _=Depends(get_current_admin),
):
    """Daily graph: per-date success/not_found/failed/total."""
    if time_filter not in VALID_TIME_FILTERS:
        time_filter = "last_7_days"
    try:
        mapping, api_name = await _resolve_scope(db, client_id, api_name)
        if mapping:
            return await analytics.get_usage_by_date(
                pan_db, mapping["access_key"], mapping.get("apis", []),
                api_name, time_filter, start_date, end_date)

        # Aggregate across all clients by date
        users = await analytics.get_dashboard_users(db)
        merged = {}
        for u in users:
            if not u.get("access_key"):
                continue
            days = await analytics.get_usage_by_date(
                pan_db, u["access_key"], u.get("apis", []),
                api_name, time_filter, start_date, end_date)
            for row in days:
                rec = merged.setdefault(row["date"], {"success": 0, "not_found": 0,
                                                      "failed": 0, "total": 0})
                rec["success"] += row["success"]
                rec["not_found"] += row["not_found"]
                rec["failed"] += row["failed"]
                rec["total"] += row["total"]
        return [{"date": d, **merged[d]} for d in sorted(merged)]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))