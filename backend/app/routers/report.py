"""
Report Router
=============

Endpoints:
    - GET    /reports/client-usage   — Daily usage report
    - GET    /reports/billing        — Monthly billing/consumption report
    - GET    /reports/api-stats      — Usage summary stats
    - GET    /reports/table          — Detailed report table data
    - POST   /reports/export         — Export report (CSV/Excel)
    - POST   /reports/invoices       — Generate an invoice for a client
    - GET    /reports/invoices       — List invoices
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional

from bson import ObjectId

from app.database import get_database, get_response_database
from bson import ObjectId

from app.dependencies.auth import get_current_admin, get_current_user
from app.schemas.common import BaseResponse, ErrorResponse
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports"])

report_service = ReportService()


def _resolve_client_scope(user: dict, client_id: Optional[str]) -> Optional[str]:
    """Clients may only access their own company data."""
    if user.get("type") == "client":
        return user.get("client_id")
    return client_id


@router.get(
    "/client-usage",
    responses={401: {"model": ErrorResponse}},
)
async def get_client_usage_report(
    client_id: Optional[str] = Query(None),
    date_range: str = Query("month", description="today | week | month | year | all"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db=Depends(get_database),
    response_db=Depends(get_response_database),
    user=Depends(get_current_user),
):
    """
    Return daily usage report data, aggregated from the response
    collections, mapped by the client's API key (access_key), whenever a
    client is in scope. Falls back to `usage_reports` for unscoped admin
    queries.
        - Query params:
        - client_id: Optional client filter
        - date_range: today | week | month | year | all
        - start_date: ISO date (for custom range)
        - end_date:   ISO date (for custom range)
    """
    scoped = _resolve_client_scope(user, client_id)

    if scoped:
        report = await report_service.get_daily_usage_report_from_response_db(
            response_db, db, client_id=scoped, time_filter=date_range,
            start_date=start_date, end_date=end_date)
        return {"data": report}

    # Unscoped (admin without a specific client): use the usage_reports source.
    if start_date and end_date:
        report = await report_service.get_daily_usage_report(
            db, client_id=None, time_filter="month"
        )
        from app.utils.helpers import parse_date_string
        sd = parse_date_string(start_date)
        ed = parse_date_string(end_date)
        if sd and ed:
            report = [r for r in report if sd.date().isoformat() <= r["date"] <= ed.date().isoformat()]
        return {"data": report}

    result = await report_service.get_daily_usage_report(
        db, client_id=None, time_filter=date_range)
    return {"data": result}


@router.get(
    "/billing",
    responses={401: {"model": ErrorResponse}},
)
async def get_billing_report(
    client_id: Optional[str] = Query(None),
    month: Optional[str] = Query(None, description="YYYY-MM format"),
    db=Depends(get_database),
    response_db=Depends(get_response_database),
    user=Depends(get_current_user),
):
    """
    Return monthly consumption/billing report, aggregated from the response
    response collections by the client's API key when a client is in scope.

    Query params:
        - client_id: Optional client filter
        - month:     "YYYY-MM" format (defaults to current month)
    """
    scoped = _resolve_client_scope(user, client_id)
    if scoped:
        result = await report_service.get_monthly_billing_report_from_response_db(
            response_db, db, client_id=scoped, month=month)
        return result
    result = await report_service.get_monthly_billing_report(
        db, client_id=None, month=month)
    return result


@router.get(
    "/api-stats",
    responses={401: {"model": ErrorResponse}},
)
async def get_api_stats(
    api_name: Optional[str] = Query(None),
    time_filter: str = Query("7d", description="24h | 7d | 30d | 90d | all"),
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Return aggregate usage summary stats.

    Query params:
        - api_name:    Optional filter by API name
        - time_filter: 24h | 7d | 30d | 90d | all
    """
    result = await report_service.get_usage_summary(db, api_name=api_name, time_filter=time_filter)
    return result


@router.get(
    "/table",
    responses={401: {"model": ErrorResponse}},
)
async def get_report_table(
    status: str = Query("all", description="all | pending | generated | paid"),
    api_name: Optional[str] = Query(None),
    client_name: Optional[str] = Query(None),
    date_range: Optional[str] = Query(None, description="7d | 30d | 90d | all"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Return detailed report table rows with invoice status info.
    """
    result = await report_service.get_report_table_data(
        db,
        status=status,
        api_name=api_name,
        client_name=client_name,
        date_range=date_range,
        start_date=start_date,
        end_date=end_date,
    )
    return result


@router.post(                             
    "/export",
    responses={401: {"model": ErrorResponse}},
)
async def export_report(
    body: dict,
    db=Depends(get_database),
    user=Depends(get_current_user),
):
    """
    Export a report as CSV or Excel.

    Body:
        - format:      "csv" | "excel" | "pdf"
        - report_type: "usage" | "daily" | "monthly" | "invoice"
        - date_range:  Optional date range
        - start_date:  Optional custom start date
        - end_date:    Optional custom end date
        - client_id:   Optional client filter
        - api_name:    Optional API filter
        - status:      Optional status filter
    """
    export_format = body.get("format", "csv")
    report_type = body.get("report_type", "usage")
    start_date = body.get("start_date")
    end_date = body.get("end_date")
    api_name = body.get("api_name")
    client_name = body.get("client_name")
    status_filter = body.get("status")
    client_id = _resolve_client_scope(user, body.get("client_id"))

    if client_id and not client_name:
        client_doc = await db["clients"].find_one({"_id": ObjectId(client_id)})
        if client_doc:
            client_name = client_doc.get("company_name")

    try:
        result = await report_service.export_report(
            db,
            export_format=export_format,
            report_type=report_type,
            status=status_filter,
            api_name=api_name,
            client_name=client_name,
            start_date=start_date,
            end_date=end_date,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post(
    "/invoices",
    responses={401: {"model": ErrorResponse}},
)
async def generate_invoice(
    body: dict,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Generate an invoice for a client for a given month.

    Body:
        - client_id: The client company ID
        - month:     "YYYY-MM" format
        - gst_percentage: Optional GST rate (default 18)
    """
    client_id = body.get("client_id")
    month = body.get("month")
    gst_percentage = body.get("gst_percentage", 18.0)

    if not client_id or not month:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id and month are required",
        )

    try:
        result = await report_service.generate_invoice(
            db, client_id=client_id, month=month, gst_percentage=gst_percentage
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/invoices",
    responses={401: {"model": ErrorResponse}},
)
async def list_invoices(
    client_id: Optional[str] = Query(None),
    status_filter: str = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    List invoices with optional filtering.
    """
    result = await report_service.get_invoices(
        db, client_id=client_id, status=status_filter, limit=limit
    )
    return result