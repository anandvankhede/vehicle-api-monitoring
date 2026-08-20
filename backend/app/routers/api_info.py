"""
API Info Router
===============

Endpoints:
    - GET /api-info     — List all APIs from the catalog
    - GET /api-info/{id} — Get a single API from the catalog
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field

from app.database import get_database, get_response_database
from app.dependencies.auth import get_current_admin, get_current_user_optional
from app.schemas.client import ApiInfoRead, ApiInfoDetailRead
from app.schemas.common import ErrorResponse, BaseResponse
from app.services.client_service import ClientService
from app.services.api_collections import (
    get_live_response_api_names,
    is_catalog_api_name,
)

router = APIRouter(prefix="/api-info", tags=["API Catalog"])

client_service = ClientService()


def _enrich_catalog_with_response_db_status(catalog: List[dict], live_names: List[str]) -> List[dict]:
    """
    Add response_db mapping status to catalog rows only.

    APIs are never auto-imported from response_db — they must be created in the
    catalog first; collection ``result_{api_name}`` is linked when it appears.
    """
    live_set = set(live_names)
    enriched = []
    for item in catalog:
        row = dict(item)
        name = row.get("name")
        if name:
            row["response_collection"] = f"result_{name}"
            row["response_db_status"] = "live" if name in live_set else "pending"
        enriched.append(row)
    enriched.sort(key=lambda item: (item.get("name") or "").lower())
    return enriched


# ============================================================================
# Schemas for API Create/Update
# ============================================================================

class ApiCreateRequest(BaseModel):
    """Request body for creating a new API in the catalog."""
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)
    category: str = Field(default="general", max_length=50)
    endpoint: str = Field(..., min_length=1, description="API endpoint path, e.g. /v1/vehicles")
    method: str = Field(default="GET", description="HTTP method: GET, POST, PUT, DELETE")
    headers: Optional[List[dict]] = Field(default_factory=list, description="Default request headers")
    request_schema: Optional[dict] = Field(default=None, description="JSON schema of request body")
    response_schema: Optional[dict] = Field(default=None, description="JSON schema of response body")
    is_active: bool = Field(default=True)
    pricing_success: float = Field(default=0.5, ge=0, description="Price per successful hit")
    pricing_not_found: float = Field(default=0.5, ge=0, description="Price per not-found hit")
    currency: str = Field(default="INR", description="Currency for pricing")
    documentation: Optional[str] = Field(default=None, description="Documentation URL or markdown")


class ApiUpdateRequest(BaseModel):
    """Request body for updating an existing API in the catalog."""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    headers: Optional[List[dict]] = None
    request_schema: Optional[dict] = None
    response_schema: Optional[dict] = None
    is_active: Optional[bool] = None
    pricing_success: Optional[float] = Field(None, ge=0)
    pricing_not_found: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = None
    documentation: Optional[str] = None


@router.get(
    "",
    responses={401: {"model": ErrorResponse}},
)
async def list_apis(
    db=Depends(get_database),
    response_db=Depends(get_response_database),
    _=Depends(get_current_user_optional),
):
    """
    List APIs from the application catalog with optional response_db link status.

    Only catalog entries are returned — response_db collections are never listed
    unless the API was created here first.
    """
    catalog = await client_service.get_all_apis(db)
    live_names = await get_live_response_api_names(response_db)
    return {
        "data": _enrich_catalog_with_response_db_status(catalog, live_names),
        "total": len(catalog),
    }


@router.get(
    "/{api_id}",
    response_model=ApiInfoDetailRead,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def get_api(
    api_id: str,
    db=Depends(get_database),
    response_db=Depends(get_response_database),
    _=Depends(get_current_user_optional),
):
    """Get a single API from the catalog by ID."""
    from bson import ObjectId
    from app.services.client_service import _serialize

    try:
        doc = await db["apis"].find_one({"_id": ObjectId(api_id)})
    except Exception:
        doc = None

    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API not found",
        )

    result = _serialize(doc)
    name = result.get("name")
    if name:
        live_names = set(await get_live_response_api_names(response_db))
        result["response_collection"] = f"result_{name}"
        result["response_db_status"] = "live" if name in live_names else "pending"
    return result


@router.post(
    "",
    response_model=BaseResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
async def create_api(
    body: ApiCreateRequest,
    db=Depends(get_database),
    admin=Depends(get_current_admin),
):
    """Create a new API in the catalog. Admin only."""
    api_name = body.name.strip().lower()
    if not is_catalog_api_name(api_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"API name '{api_name}' is invalid. Use lowercase letters, numbers, "
                f"and underscores (e.g. test, rc_data). Response_db collection will be "
                f"result_{api_name} when created."
            ),
        )

    existing = await db["apis"].find_one({"name": api_name})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"API with name '{api_name}' already exists.",
        )

    now = datetime.now(timezone.utc)
    doc = {
        "name": api_name,
        "description": body.description.strip(),
        "category": body.category.strip().lower(),
        "endpoint": body.endpoint.strip(),
        "method": body.method.upper(),
        "headers": body.headers or [],
        "request_schema": body.request_schema,
        "response_schema": body.response_schema,
        "is_active": body.is_active,
        "pricing_success": body.pricing_success,
        "pricing_not_found": body.pricing_not_found,
        "currency": body.currency,
        "documentation": body.documentation,
        "created_by": admin.get("username", "admin"),
        "created_at": now,
        "updated_at": now,
    }
    await db["apis"].insert_one(doc)
    return BaseResponse(success=True, message="API created successfully.")


@router.put(
    "/{api_id}",
    response_model=BaseResponse,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
async def update_api(
    api_id: str,
    body: ApiUpdateRequest,
    db=Depends(get_database),
    admin=Depends(get_current_admin),
):
    """Update an existing API in the catalog. Admin only."""
    from bson import ObjectId
    try:
        existing = await db["apis"].find_one({"_id": ObjectId(api_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API not found",
        )

    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API not found",
        )

    update_data = {
        k: v for k, v in body.model_dump(exclude_unset=True).items()
        if v is not None or isinstance(v, bool)
    }
    if not update_data:
        return BaseResponse(success=True, message="No changes to apply.")

    if "name" in update_data:
        update_data["name"] = update_data["name"].strip().lower()

    if "name" in update_data and not is_catalog_api_name(update_data["name"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"API name '{update_data['name']}' is invalid. Use lowercase letters, "
                f"numbers, and underscores. Response_db collection will be "
                f"result_{update_data['name']} when created."
            ),
        )

    update_data["updated_at"] = datetime.now(timezone.utc)

    if "method" in update_data:
        update_data["method"] = update_data["method"].upper()

    await db["apis"].update_one(
        {"_id": ObjectId(api_id)},
        {"$set": update_data},
    )

    return BaseResponse(success=True, message="API updated successfully.")


@router.delete(
    "/{api_id}",
    response_model=BaseResponse,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
async def delete_api(
    api_id: str,
    db=Depends(get_database),
    admin=Depends(get_current_admin),
):
    """Delete an API from the catalog. Admin only."""
    from bson import ObjectId
    try:
        result = await db["apis"].delete_one({"_id": ObjectId(api_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API not found",
        )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API not found",
        )

    return BaseResponse(success=True, message="API deleted successfully.")
