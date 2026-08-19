"""
Dashboard Router
================

Endpoints:
    - GET /dashboard/stats            — Dashboard summary stats
    - GET /dashboard/analytics        — User options + API options
    - GET /dashboard/recent-activity  — Recent activity feed
    - GET /dashboard/api-usage        — API usage monitoring stats
    - GET /dashboard/user-api-stats   — Per-client API KPI grid
    - GET /dashboard/client-analytics — Client analytics table data
    - GET /dashboard/client-details   — Per-client API detail trends
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional

from app.database import get_database, get_response_database, db_manager
from app.dependencies.auth import get_current_admin
from app.schemas.common import ErrorResponse
from app.services.dashboard_service import DashboardService
from app.services import analytics_service as analytics

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

dashboard_service = DashboardService()


@router.get(
    "/stats",
    responses={401: {"model": ErrorResponse}},
)
async def get_dashboard_stats(
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Return dashboard summary stats:
        - totalClients
        - totalApis
        - healthyApisCount
        - degradedApisCount
    """
    result = await dashboard_service.get_dashboard_stats(db)
    return {
        "totalClients": result["total_clients"],
        "totalApis": result["total_apis"],
        "healthyApisCount": result["healthy_apis_count"],
        "degradedApisCount": result["degraded_apis_count"],
        "responseDbAvailable": db_manager.response_db_ready,
    }


@router.get(
    "/analytics",
    responses={401: {"model": ErrorResponse}},
)
async def get_dashboard_analytics(
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Return the combined analytics payload:
        - summary: Dashboard summary stats
        - userOptions: List of clients for the global filter
        - apiOptions: List of APIs for the monitoring dropdown
    """
    summary = await dashboard_service.get_dashboard_stats(db)
    user_options = await dashboard_service.get_user_options(db)
    api_options = await dashboard_service.get_api_options(db)

    return {
        "summary": {
            "totalClients": summary["total_clients"],
            "totalApis": summary["total_apis"],
            "healthyApisCount": summary["healthy_apis_count"],
            "degradedApisCount": summary["degraded_apis_count"],
        },
        "userOptions": user_options,
        "apiOptions": api_options,
    }


@router.get(
    "/users",
    responses={401: {"model": ErrorResponse}},
)
async def get_dashboard_users(
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Return the list of enterprise clients for the global filter.

    Each option:
        - id:   Client ID
        - name: Company name
        - code: Derived from username
        - type: "enterprise" | "pro" | "standard"
    """
    options = await dashboard_service.get_user_options(db)
    # Prepend the "All Users" option
    return [
        {"id": "all", "name": "All Users", "code": "ALL_CLIENTS", "type": "enterprise"},
        *options,
    ]


@router.get(
    "/apis",
    responses={401: {"model": ErrorResponse}},
)
async def get_dashboard_apis(
    client_id: str = Query("all", description="Client ID; 'all' for all PAN APIs"),
    db=Depends(get_database),
    response_db=Depends(get_response_database),
    _=Depends(get_current_admin),
):
    """
    Return APIs for the monitoring dropdown.

    - all: every API whose PAN collection currently exists
    - client: assigned APIs whose PAN collections currently exist
    """
    return await dashboard_service.get_api_options(
        db, client_id=client_id, response_db=response_db,
    )


@router.get(
    "/user-api-stats",
    responses={401: {"model": ErrorResponse}},
)
async def get_user_api_stats(
    client_id: str = Query("all", description="Client ID; 'all' for all clients"),
    time_filter: str = Query("last_7_days"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db=Depends(get_database),
    response_db=Depends(get_response_database),
    _=Depends(get_current_admin),
):
    """
    Return per-API KPI grid stats for the selected client and time filter,
    aggregated directly from the response database via user_mapping.

    For the selected user(s), the backend reads user_mapping -> access_key +
    apis[], maps each api to its response collection, and sums the request
    buckets (success / not_found / failed) in the chosen time range.

    Each item:
        - id, name, category, totalHits, success, notFound, failed
        - status ("healthy" | "degraded" | "down")
        - trendPercentage, trendDirection (vs previous window)
    """
    valid = {"today", "yesterday", "last_7_days", "last_month", "custom"}
    if time_filter not in valid:
        time_filter = "today"
    try:
        return await analytics.get_user_api_stats(
            response_db, db, client_id, time_filter, start_date, end_date)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/api-usage",
    responses={401: {"model": ErrorResponse}},
)
async def get_api_usage(
    api_id: str = Query(..., description="API ID to monitor"),
    client_id: str = Query("all", description="Client ID; 'all' for global PAN stats"),
    time_filter: str = Query("last_7_days", description="last_30_min | last_1_hour | last_2_hours | last_3_hours | last_4_hours | last_5_hours | today | yesterday | last_7_days | last_month | custom"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db=Depends(get_database),
    response_db=Depends(get_response_database),
    _=Depends(get_current_admin),
):
    """
    Return detailed monitoring stats for a single API, aggregated from the
    response collections:
        - distribution: Pie chart segments (Success / Failed / Not Found)
        - trendData: Line chart points bucketed to the selected time filter
        - totalHits, successRate, avgLatencyMs, uptimePercentage
    """
    try:
        return await analytics.get_api_usage_stats(
            response_db, db, api_id, time_filter, start_date, end_date, client_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get(
    "/recent-activity",
    responses={401: {"model": ErrorResponse}},
)
async def get_recent_activity(
    limit: int = Query(10, ge=1, le=50),
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Return recent activity records for the dashboard feed.
    """
    result = await dashboard_service.get_recent_activity(db, limit=limit)
    return {"data": result}


@router.get(
    "/client-analytics",
    responses={401: {"model": ErrorResponse}},
)
async def get_client_analytics(
    client_id: str = Query("all"),
    api_id: str = Query("all"),
    time_filter: str = Query("last_7_days"),
    status_filter: str = Query("all"),
    search_query: str = Query(""),
    sort_by: str = Query("totalHits"),
    sort_order: str = Query("desc"),
        start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db=Depends(get_database),
    response_db=Depends(get_response_database),
    _=Depends(get_current_admin),
):
    """
    Return filtered, sorted client analytics data, aggregated from the response
    (response) collections via each client's access key.

    Query params:
        - client_id:    "all" or a specific client ID
        - api_id:       "all" or a specific API ID
        - time_filter:  today | yesterday | last_7_days | last_month | last_30_min | last_N_hours | custom
        - status_filter: all | success | failed | notFound
        - search_query:  Filter by client name/code/API name
        - sort_by:      totalHits | successRate | avgResponseTimeMs | clientName | apiName | notFound | failed | success
        - sort_order:   asc | desc
        - start_date:   ISO date (for custom range)
        - end_date:     ISO date (for custom range)
    """
    try:
        result = await analytics.get_client_analytics_stats(
            response_db, db,
            client_id=client_id,
            api_id=api_id,
            time_filter=time_filter,
            status_filter=status_filter,
            search_query=search_query,
            sort_by=sort_by,
            sort_order=sort_order,
            start_date=start_date,
            end_date=end_date,
        )
        # Convert snake_case to camelCase for the frontend
        records = []
        for r in result.get("records", []):
            records.append({
                "id": r["id"],
                "clientId": r["client_id"],
                "clientName": r["client_name"],
                "clientCode": r.get("client_code", ""),
                "apiId": r.get("api_id", ""),
                "apiName": r["api_name"],
                "apiCategory": r.get("api_category", "vehicle"),
                "totalHits": r["total_hits"],
                "success": r["success"],
                "failed": r["failed"],
                "notFound": r["not_found"],
                "avgResponseTimeMs": r.get("avg_response_time_ms", 0),
                "successRate": r["success_rate"],
                "timestamp": r.get("timestamp", ""),
                "date": r.get("date", ""),
            })

        summary = result.get("summary", {})
        return {
            "records": records,
            "summary": {
                "totalClients": summary.get("total_clients", 0),
                "totalApis": summary.get("total_apis", 0),
                "totalHits": summary.get("total_hits", 0),
                "overallSuccessRate": summary.get("overall_success_rate", 0),
                "avgResponseTimeMs": summary.get("avg_response_time_ms", 0),
            },
            "totalRecords": result.get("total_records", 0),
            "filteredRecords": result.get("filtered_records", 0),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get(
    "/client-analytics/export",
    responses={401: {"model": ErrorResponse}},
)
async def export_client_analytics_detail(
    client_id: str = Query(..., description="Client ID (required)"),
    api_id: Optional[str] = Query(None),
    api_name: Optional[str] = Query(None),
    time_filter: str = Query("last_7_days"),
    status_filter: str = Query("all"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db=Depends(get_database),
    response_db=Depends(get_response_database),
    _=Depends(get_current_admin),
):
    """
    Export raw transaction rows for one client + API as CSV.

    Respects the same time and status filters as the Client Analytics table.
    """
    try:
        return await analytics.export_client_analytics_detail(
            response_db,
            db,
            client_id=client_id,
            api_id=api_id,
            api_name=api_name,
            time_filter=time_filter,
            status_filter=status_filter,
            start_date=start_date,
            end_date=end_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/client-details",
    responses={401: {"model": ErrorResponse}},
)
async def get_client_details(
    client_id: str = Query("all"),
    time_filter: str = Query("last_7_days"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db=Depends(get_database),
    response_db=Depends(get_response_database),
    _=Depends(get_current_admin),
):
    """
    Return per-client API detail trend data, aggregated from the response
    (response) collections.

    Query params:
        - client_id:   "all" or a specific client ID
        - time_filter: last_30_min | last_1_hour | last_2_hours | ... | today | yesterday | last_7_days | last_month | custom
    """
    try:
        return await analytics.get_client_details_stats(
            response_db, db, client_id, time_filter, start_date, end_date)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))