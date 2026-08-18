"""
Dashboard Schemas
=================

Pydantic models for dashboard endpoints:
    - Dashboard summary stats (total clients, total APIs, health)
    - User options (client list for global filter)
    - User API stats (per-API KPI grid)
    - Available APIs
    - API monitoring stats (trend + distribution for a single API)
    - Recent activity feed

These schemas match the TypeScript types in src/types/dashboard.ts.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ---------------------------------------------------------------------------
# Dashboard Summary
# ---------------------------------------------------------------------------

class DashboardSummary(BaseModel):
    """
    Top-level dashboard statistics shown in the header.

    Returned by GET /dashboard/stats.
    """

    total_clients: int           # count of all clients in the system
    total_apis: int              # count of available APIs in the catalog
    healthy_apis_count: int      # APIs with >= 95% success rate
    degraded_apis_count: int     # APIs with < 95% but >= 80% success rate


# ---------------------------------------------------------------------------
# User Options (for the global filter dropdown)
# ---------------------------------------------------------------------------

class UserOption(BaseModel):
    """
    An entry in the dashboard's user/client filter dropdown.

    Note: In this system, "users" in the dashboard filter context
    actually refers to client companies. The frontend calls these
    "users" but they map to the clients collection.
    """

    id: str
    name: str
    code: str
    type: Optional[str] = None   # "enterprise" | "pro" | "standard"


# ---------------------------------------------------------------------------
# User API Stats (KPI Grid)
# ---------------------------------------------------------------------------

class UserApiStats(BaseModel):
    """
    Statistics for a single API, shown as a KPI card in the dashboard grid.

    The "user" in the name refers to the client/company selected in the
    dashboard filter — stats are aggregated for that client.
    """

    id: str
    name: str                              # e.g., "API 1"
    category: str                          # "vehicle" | "garage" | "payment" | ...
    total_hits: int
    success: int
    not_found: int
    failed: int
    status: str                            # "healthy" | "degraded" | "down"
    trend_percentage: float                # e.g., 4.8 (positive = improving)
    trend_direction: str                   # "up" | "down" | "stable"
    avg_response_time_ms: int


# ---------------------------------------------------------------------------
# Available APIs (for the main monitoring dropdown)
# ---------------------------------------------------------------------------

class ApiOption(BaseModel):
    """An API available in the monitoring section dropdown."""

    id: str
    name: str
    category: str


# ---------------------------------------------------------------------------
# Request Distribution (Pie Chart)
# ---------------------------------------------------------------------------

class RequestDistributionData(BaseModel):
    """
    A single slice in the request distribution pie chart.
    """

    name: str                              # "Success" | "Failed" | "Not Found"
    value: int                             # count of requests
    color: str                             # hex color for the chart
    percentage: float                      # 0-100


# ---------------------------------------------------------------------------
# Request Trend Data (Line Chart)
# ---------------------------------------------------------------------------

class RequestTrendDataPoint(BaseModel):
    """
    A single data point on the request trend line chart.
    """

    time: str                              # label, e.g., "05m ago" or "Mon"
    total: int
    success: int
    failed: int
    not_found: int


# ---------------------------------------------------------------------------
# API Monitoring Stats (Full monitoring view for a single API)
# ---------------------------------------------------------------------------

class ApiMonitoringStats(BaseModel):
    """
    Aggregated statistics for a single API over a time range.
    Includes distribution (pie), trend (line), and summary metrics.

    Returned by GET /dashboard/api-usage.
    """

    api_id: str
    api_name: str
    time_filter: str
    distribution: List[RequestDistributionData]
    trend_data: List[RequestTrendDataPoint]
    total_hits: int
    success_rate: float                     # percentage 0-100
    avg_latency_ms: int
    uptime_percentage: float                # e.g., 99.94


# ---------------------------------------------------------------------------
# Recent Activity
# ---------------------------------------------------------------------------

class RecentActivityItem(BaseModel):
    """
    A single recent activity item shown on the dashboard.
    """

    id: str
    type: str
    title: str
    message: str
    date: datetime
    status: str


# ---------------------------------------------------------------------------
# Client Analytics Data (for ClientAnalytics page)
# ---------------------------------------------------------------------------

class ClientActivityRecord(BaseModel):
    """
    A single row in the client analytics table.
    Shows per-client-per-API usage statistics.
    """

    id: str
    client_id: str
    client_name: str
    client_code: str
    api_id: str
    api_name: str
    api_category: str
    total_hits: int
    success: int
    failed: int
    not_found: int
    avg_response_time_ms: int
    success_rate: float
    timestamp: str
    date: str


class ClientAnalyticsSummary(BaseModel):
    """
    Summary statistics for the client analytics view.
    """

    total_clients: int
    total_apis: int
    total_hits: int
    overall_success_rate: float
    avg_response_time_ms: int


class ClientAnalyticsData(BaseModel):
    """
    Full response for the client analytics endpoint.
    Includes paginated records and summary statistics.
    """

    records: List[ClientActivityRecord]
    summary: ClientAnalyticsSummary
    total_records: int
    filtered_records: int


# ---------------------------------------------------------------------------
# Details Chart Data (for DetailsChart page)
# ---------------------------------------------------------------------------

class ClientApiTrendDataPoint(BaseModel):
    """A single point on the per-client API trend chart."""

    time: str
    total: int
    success: int
    failed: int
    not_found: int


class ClientApiDetail(BaseModel):
    """Aggregated stats for a single API used by a specific client."""

    api_id: str
    api_name: str
    category: str
    total_hits: int
    success: int
    failed: int
    not_found: int
    avg_response_time_ms: int
    trend_data: List[ClientApiTrendDataPoint]


class ClientDetailsData(BaseModel):
    """
    Full response for the details chart endpoint.
    Contains per-API trend data for a selected client.
    """

    client_id: str
    client_name: str
    time_filter: str
    apis: List[ClientApiDetail]


# ---------------------------------------------------------------------------
# Response wrappers
# ---------------------------------------------------------------------------

class DashboardStatsResponse(BaseModel):
    """Response for GET /dashboard/stats."""

    total_clients: int
    total_apis: int
    healthy_apis_count: int
    degraded_apis_count: int


class DashboardAnalyticsResponse(BaseModel):
    """Response for GET /dashboard/analytics."""

    summary: DashboardSummary
    user_options: List[UserOption]
    api_options: List[ApiOption]
