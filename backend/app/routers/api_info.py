"""
API Info Router
===============

Endpoints:
    - GET /api-info     — List all available APIs from the catalog
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
from app.services.api_collections import get_live_pan_api_names, is_valid_api_name

router = APIRouter(prefix="/api-info", tags=["API Catalog"])

client_service = ClientService()


def _merge_live_pan_apis(catalog: List[dict], live_names: List[str]) -> List[dict]:
    """Include live PAN APIs in the catalog list without persisting them."""
    catalog_names = {item.get("name") for item in catalog if item.get("name")}
    merged = list(catalog)
    for name in live_names:
        if name in catalog_names:
            continue
        merged.append({
            "id": name,
            "name": name,
            "description": f"Discovered from PAN collection result_{name}",
            "category": "vehicle",
            "endpoint": f"/{name}",
            "method": "POST",
            "headers": [],
            "request_schema": None,
            "response_schema": None,
            "is_active": True,
            "pricing_success": 0.5,
            "pricing_not_found": 0.5,
            "currency": "INR",
            "documentation": None,
            "source": "pan",
        })
    merged.sort(key=lambda item: (item.get("name") or "").lower())
    return merged


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
    List APIs from the catalog merged with live PAN-discovered APIs.
    """
    catalog = await client_service.get_all_apis(db)
    live_names = await get_live_pan_api_names(response_db)
    merged = _merge_live_pan_apis(catalog, live_names)
    return {"data": merged, "total": len(merged)}


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
    """
    Get a single API from the catalog by ID (full details for edit/view).
    """
    from bson import ObjectId
    try:
        doc = await db["apis"].find_one({"_id": ObjectId(api_id)})
    except Exception:
        doc = None
    if doc is None:
        live_names = await get_live_pan_api_names(response_db)
        if api_id not in live_names:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API not found",
            )
        return {
            "id": api_id,
            "name": api_id,
            "description": f"Discovered from PAN collection result_{api_id}",
            "category": "vehicle",
            "endpoint": f"/{api_id}",
            "method": "POST",
            "headers": [],
            "request_schema": None,
            "response_schema": None,
            "is_active": True,
            "pricing_success": 0.5,
            "pricing_not_found": 0.5,
            "currency": "INR",
            "documentation": None,
            "source": "pan",
        }
    from app.services.client_service import _serialize
    return _serialize(doc)


@router.post(
    "",
    response_model=BaseResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
)
async def create_api(
    body: ApiCreateRequest,
    db=Depends(get_database),
    response_db=Depends(get_response_database),
    admin=Depends(get_current_admin),
):
    """Create a new API in the catalog. Admin only."""
    api_name = body.name.strip()
    if not await is_valid_api_name(api_name, response_db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"API name '{api_name}' does not have a live PAN collection "
                f"(expected result_{api_name}). Create the collection first."
            ),
        )

    existing = await db["apis"].find_one({
        "name": {"$regex": f"^{body.name}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"API with name '{body.name}' already exists.",
        )

    now = datetime.now(timezone.utc)
    doc = {
        "name": body.name.strip(),
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
    response_db=Depends(get_response_database),
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

    if "name" in update_data and not await is_valid_api_name(
        update_data["name"].strip(), response_db
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"API name '{update_data['name']}' does not have a live PAN collection. "
                "Create the collection first."
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
