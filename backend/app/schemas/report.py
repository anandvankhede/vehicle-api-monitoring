"""
Report Schemas
==============

Pydantic models for usage reports, billing summaries, and invoices.

These schemas match the TypeScript interfaces in src/types/reports.ts.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ---------------------------------------------------------------------------
# Daily Usage Report
# ---------------------------------------------------------------------------

class DailyUsageReport(BaseModel):
    """
    One day's worth of usage statistics.

    Returned as an array by GET /reports/client-usage.
    """

    date: str
    success_requests: int
    failed_requests: int
    not_found_requests: int
    total_requests: int
    revenue: float
    cost: float
    avg_response_time: float


# ---------------------------------------------------------------------------
# Monthly Consumption Report
# ---------------------------------------------------------------------------

class ApiUsageStat(BaseModel):
    """
    A single API's usage statistics, used in top_apis lists.
    """

    api_name: str
    count: int
    percentage: float


class MonthlyConsumptionReport(BaseModel):
    """
    Summary of all API usage for a given month.

    Returned by GET /reports/billing (or GET /reports/client-usage).
    """

    month: str
    year: int
    total_requests: int
    success_requests: int
    failed_requests: int
    not_found_requests: int
    total_cost: float
    total_revenue: float
    avg_daily_usage: int
    top_apis: List[ApiUsageStat]
    top_failure_apis: List[ApiUsageStat]
    peak_usage_date: str


# ---------------------------------------------------------------------------
# Usage Summary (Overview)
# ---------------------------------------------------------------------------

class UsageSummary(BaseModel):
    """
    Aggregate summary for a date range.

    Returned by GET /reports/api-stats.
    """

    total_hits: int
    successful_requests: int
    failed_requests: int
    not_found_requests: int
    total_revenue: float
    total_cost: float
    avg_response_time: float
    success_rate: float


# ---------------------------------------------------------------------------
# Detailed Report Table Row
# ---------------------------------------------------------------------------

class ReportTableRow(BaseModel):
    """
    A single row in the detailed usage report table.
    """

    id: str
    date: str
    client_name: str
    api_name: str
    endpoint: str
    success: int
    failed: int
    not_found: int
    total_requests: int
    success_cost: float
    not_found_cost: float
    total_cost: float
    avg_response_time: float
    invoice_status: str                     # "pending" | "generated" | "paid"
    invoice_month: Optional[str] = None
    invoice_year: Optional[int] = None


# ---------------------------------------------------------------------------
# Invoice
# ---------------------------------------------------------------------------

class ApiUsageItem(BaseModel):
    """A single API line item in an invoice."""

    api_name: str
    success_requests: int
    not_found_requests: int
    success_cost: float
    not_found_cost: float
    total_cost: float


class Invoice(BaseModel):
    """
    A complete invoice document.

    Returned by POST /invoices/generate and GET /invoices.
    """

    id: str
    invoice_number: str
    client_id: str
    client_name: str
    company_name: str
    invoice_date: str
    billing_period_start: str
    billing_period_end: str
    api_wise_usage: List[ApiUsageItem]
    subtotal: float
    gst_percentage: float
    gst_amount: float
    grand_total: float
    currency: str
    status: str                              # "pending" | "paid" | "overdue"
    created_at: datetime


# ---------------------------------------------------------------------------
# Export Options
# ---------------------------------------------------------------------------

class ReportExportRequest(BaseModel):
    """
    Request body for POST /reports/export (or GET /reports/export with query params).
    """

    format: str = Field(default="csv", description="excel | csv | pdf")
    report_type: str = Field(default="daily", description="usage | daily | monthly | invoice")
    date_range: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    client_id: Optional[str] = None
    api_name: Optional[str] = None
    status: Optional[str] = None


# ---------------------------------------------------------------------------
# Response wrappers
# ---------------------------------------------------------------------------

class ReportTableResponse(BaseModel):
    """Response for GET /reports (table data + pagination)."""

    data: List[ReportTableRow]
    total: int


class InvoiceListResponse(BaseModel):
    """Response for GET /invoices."""

    data: List[Invoice]
    total: int
