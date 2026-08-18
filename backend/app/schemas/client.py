"""
Client Management Schemas
==========================

Pydantic models for the Client domain — companies, their users, API
access requests, API subscriptions, audit entries, and activity records.

These schemas mirror the TypeScript interfaces defined in the frontend
(src/types/client.ts) to ensure type compatibility between frontend
and backend.

Naming convention:
    - "Base" suffix: shared fields used by both create and update schemas
    - "Create" suffix: fields required when creating a new record
    - "Update" suffix: optional fields for partial updates
    - "Read" suffix: fields returned in API responses (includes id, timestamps)
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.schemas.common import PaginatedResponse, PaginationMetadata



# ============================================================================
# ENUM-LIKE TYPES (matching frontend string-literal types)
# ============================================================================

RequestStatus = str           # "Pending" | "Approved"
ApiRequestStatus = str        # "Pending Approval" | "Approved" | "Rejected"
ClientApiStatus = str         # "Active" | "Suspended" | "Expired" | "Not Assigned" | "Pending Approval"
Currency = str                # "INR" | "USD" | "EUR" | "GBP"
RequestLimitFrequency = str   # "Per Minute" | "Per Hour" | "Per Day" | "Per Month" | "Per Year"
ActivityStatus = str          # "Submitted" | "Under Review" | "Approved" | "Changes Required" | "Pending Approval"
ActivityType = str            # "Company Registration" | "API Request" | "Profile Update"
ClientAccountStatus = str     # "Pending" | "Under Review" | "Changes Required" | "Approved" | "Inactive"


# ============================================================================
# CLIENT SCHEMAS
# ============================================================================

class ClientBase(BaseModel):
    """
    Shared fields for create and update operations on a Client.
    """

    company_name: str = Field(..., min_length=1, max_length=255)
    username: str = Field(..., min_length=3, max_length=100)
    address: str = Field(..., min_length=1)
    gstin: str = Field(..., min_length=15, max_length=15, description="Indian GSTIN (15 characters)")
    pan: str = Field(..., min_length=10, max_length=10, description="Indian PAN (10 characters)")
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone: str = Field(..., min_length=10, max_length=20)
    selected_apis: List[str] = Field(default_factory=list)
    comments: str = Field(default="")
    request_status: RequestStatus = Field(default="Pending")
    status: str = Field(default="Active")  # "Active" | "Inactive"


class ClientCreate(ClientBase):
    """
    Fields required when creating a new client via POST /clients.
    The password is also required (it will be hashed before storage).
    """

    password: str = Field(..., min_length=8, description="Plain-text password (hashed before storage)")


class ClientUpdate(BaseModel):
    """
    Optional fields for updating an existing client via PUT /clients/{id}.
    All fields are optional — only provided fields are updated.
    """

    company_name: Optional[str] = None
    username: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    selected_apis: Optional[List[str]] = None
    comments: Optional[str] = None
    request_status: Optional[RequestStatus] = None
    status: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)


class ClientRead(BaseModel):
    """
    Schema returned in API responses for a single client.
    Includes the MongoDB _id as a string "id".
    """

    id: str
    username: str
    company_name: str
    address: str
    gstin: str
    pan: str
    email: str
    phone: str
    selected_apis: List[str]
    comments: str
    request_status: RequestStatus
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # allows reading from ORM-like dicts


# ============================================================================
# CLIENT USER SCHEMAS
# ============================================================================

class ClientUserBase(BaseModel):
    """Shared fields for client user create/update."""

    client_id: str
    username: str = Field(..., min_length=3, max_length=100)
    role: str = Field(default="CLIENT")


class ClientUserCreate(ClientUserBase):
    """Fields required when creating a client user."""

    password: str = Field(..., min_length=8)


class ClientUserUpdate(BaseModel):
    """Optional fields for updating a client user."""

    username: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)
    role: Optional[str] = None
    status: Optional[str] = None


class ClientUserRead(BaseModel):
    """Schema returned in API responses for a client user."""

    id: str
    client_id: str
    username: str
    role: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PasswordResetRequest(BaseModel):
    """Request body for POST /client-users/{id}/reset-password."""
    new_password: str = Field(..., min_length=8)


# ============================================================================
# API REQUEST SCHEMAS (API Access Requests)
# ============================================================================

class ApiRequestBase(BaseModel):
    """Shared fields for API access requests."""

    client_id: str
    api_name: str = Field(..., min_length=1)


class ApiRequestRead(BaseModel):
    """Schema returned in API responses for an API access request."""

    id: str
    client_id: str
    api_name: str
    status: ApiRequestStatus
    requested_at: datetime
    reviewed_at: Optional[datetime] = None
    reason: Optional[str] = None

    class Config:
        from_attributes = True


class ApiRequestApproveRequest(BaseModel):
    """
    Request body for POST /api-requests/{id}/approve.
    Contains the pricing and configuration for the new API access.
    """

    price_per_hit: float = Field(..., ge=0)
    success_price_per_hit: float = Field(..., ge=0)
    not_found_price_per_hit: float = Field(..., ge=0)
    currency: Currency = Field(default="INR")
    request_limit: int = Field(..., ge=1)
    limit_frequency: RequestLimitFrequency
    expiry_date: Optional[str] = None
    status: str = Field(default="Active")  # "Active" | "Suspended"


class ApiRequestRejectRequest(BaseModel):
    """
    Request body for POST /api-requests/{id}/reject.
    """

    reason: str = Field(..., min_length=1, description="Reason for rejecting the request")


# ============================================================================
# API ACCESS SCHEMAS (Client API Subscriptions)
# ============================================================================

class ApiAccessBase(BaseModel):
    """Shared fields for API access (client subscription)."""

    client_id: str
    api_name: str
    api_key: Optional[str] = None
    success_price_per_hit: float = Field(default=0.5, ge=0)
    not_found_price_per_hit: float = Field(default=0.5, ge=0)
    currency: Currency = Field(default="INR")
    request_limit: int = Field(default=10000, ge=1)
    limit_frequency: RequestLimitFrequency = Field(default="Per Day")
    expiry_date: Optional[str] = None
    status: str = Field(default="Active")  # "Active" | "Suspended" | "Expired"


class ApiAccessCreate(ApiAccessBase):
    """Fields required when creating a new API access record."""
    current_usage: int = Field(default=0)
    assigned_by: str = Field(default="admin")


class ApiAccessUpdate(BaseModel):
    """Optional fields for updating an API access record."""

    success_price_per_hit: Optional[float] = Field(None, ge=0)
    not_found_price_per_hit: Optional[float] = Field(None, ge=0)
    price_per_hit: Optional[float] = Field(None, ge=0)
    currency: Optional[Currency] = None
    request_limit: Optional[int] = Field(None, ge=1)
    limit_frequency: Optional[RequestLimitFrequency] = None
    status: Optional[str] = None
    expiry_date: Optional[str] = None
    api_key: Optional[str] = None


class ApiAccessRead(BaseModel):
    """Schema returned in API responses for an API access record."""

    id: str
    client_id: str
    api_name: str
    status: str
    api_key: str
    price_per_hit: float
    success_price_per_hit: float
    not_found_price_per_hit: float
    currency: Currency
    request_limit: int
    limit_frequency: RequestLimitFrequency
    current_usage: int
    expiry_date: Optional[str] = None
    assigned_at: datetime
    assigned_by: str
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# ACTIVITY RECORD SCHEMAS
# ============================================================================

class ActivityRecordRead(BaseModel):
    """Schema for a client activity feed entry."""

    id: str
    client_id: str
    type: ActivityType
    title: str
    status: ActivityStatus
    message: str
    date: datetime
    reason: Optional[str] = None
    api_name: Optional[str] = None
    action: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================================
# AUDIT LOG SCHEMAS
# ============================================================================

class AuditLogRead(BaseModel):
    """Schema for an admin audit log entry."""

    id: str
    admin_username: str
    action: str
    details: str
    timestamp: datetime

    class Config:
        from_attributes = True


# ============================================================================
# CLIENT AUDIT ENTRY SCHEMAS
# ============================================================================

class ClientAuditEntryRead(BaseModel):
    """Schema for a client-specific audit entry."""

    id: str
    client_id: str
    action: str
    details: str
    admin_username: str
    timestamp: datetime

    class Config:
        from_attributes = True


# ============================================================================
# REGISTRATION REQUEST SCHEMAS
# ============================================================================

class RegistrationRequestRead(BaseModel):
    """Schema for a registration request."""

    id: str
    client_id: str
    company_name: str
    email: str
    phone: str
    requested_apis: List[str]
    submitted_date: datetime
    status: str
    reason: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================================
# USAGE / BILLING SCHEMAS
# ============================================================================

class ClientUsageSummary(BaseModel):
    """Per-API usage summary for a client."""

    api_name: str
    total_hits: int
    remaining_requests: int
    current_usage: int
    request_limit: int
    usage_percent: int
    total_cost: float
    currency: Currency
    price_per_hit: float


class ClientBillingItem(BaseModel):
    """Single line item in a billing summary."""

    api_name: str
    total_hits: int
    price_per_hit: float
    total_cost: float
    currency: Currency


class ClientBillingSummary(BaseModel):
    """Full billing summary for a client."""

    monthly_cost: float
    currency: Currency
    items: List[ClientBillingItem]


# ============================================================================
# AVAILABLE API INFO (read-only)
# ============================================================================

class ApiInfoRead(BaseModel):
    """Schema for an available API from the catalog (list view)."""

    id: str
    name: str
    description: str
    category: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ApiInfoDetailRead(BaseModel):
    """Full API catalog record for view/edit screens."""

    id: str
    name: str
    description: str
    category: str
    endpoint: str = ""
    method: str = "GET"
    headers: List[dict] = Field(default_factory=list)
    request_schema: Optional[dict] = None
    response_schema: Optional[dict] = None
    is_active: bool = True
    pricing_success: Optional[float] = None
    pricing_not_found: Optional[float] = None
    currency: Optional[str] = None
    documentation: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================================
# PAGINATED RESPONSES
# ============================================================================

class ClientListResponse(BaseModel):
    """Response for GET /clients — returns all clients (admin view)."""

    data: List[ClientRead]
    total: int
    pagination: PaginationMetadata


