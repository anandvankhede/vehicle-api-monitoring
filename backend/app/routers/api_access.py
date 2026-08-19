"""
API Access Router
=================

Endpoints:
    - GET    /api-access                    — List all API access records
    - POST   /api-access                    — Assign an API to a client
    - GET    /api-access/{id}               — Get a single API access record
    - PUT    /api-access/{id}               — Update API access (pricing, limits)
    - DELETE /api-access/{id}               — Delete an API access record
    - POST   /api-access/{id}/regenerate-key — Generate a new API key
    - GET    /api-access/client/{client_id} — List API access for a client
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import get_database, get_response_database
from app.dependencies.auth import get_current_admin, get_current_user
from app.schemas.client import (
    ApiAccessCreate,
    ApiAccessUpdate,
    ApiAccessRead,
)
from app.schemas.common import BaseResponse, ErrorResponse
from app.services.client_service import ClientService
from app.services.api_collections import is_registered_api_name

router = APIRouter(prefix="/api-access", tags=["API Access"])

client_service = ClientService()


@router.get(
    "",
    responses={401: {"model": ErrorResponse}},
)
async def list_api_access(
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    List all API access records (admin view).
    """
    try:
        result = await client_service.get_all_api_access(db)
        return {"data": result, "total": len(result)}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve API access records",
        )


@router.post(
    "",
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def assign_api(
    body: ApiAccessCreate,
    db=Depends(get_database),
    response_db=Depends(get_response_database),
    _=Depends(get_current_admin),
):
    """
    Assign an API to a client with optional pricing/limits.

    Body:
        - client_id:                     The client company ID
        - api_name:                      The API name
        - success_price_per_hit:         Price per successful request (default 0.5)
        - not_found_price_per_hit:       Price per not-found response (default 0.5)
        - currency:                      "INR" | "USD" | "EUR" | "GBP"
        - request_limit:                 Max requests (default 10000)
        - limit_frequency:               "Per Minute" | "Per Hour" | "Per Day" | "Per Month" | "Per Year"
        - expiry_date:                   Optional expiry date
        - status:                        "Active" | "Suspended"
    """
    try:
        if not await is_registered_api_name(db, body.api_name, response_db):
            raise ValueError(
                f"API '{body.api_name}' is not registered. Add it in API Management "
                f"first (PAN collection result_{body.api_name} can be created later)."
            )
        result = await client_service.assign_api(db, body.model_dump())
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/client/{client_id}",
    responses={401: {"model": ErrorResponse}},
)
async def get_client_api_access(
    client_id: str,
    db=Depends(get_database),
    user=Depends(get_current_user),
):
    # Clients can only see their own API access records
    if user.get("type") == "client" and user.get("client_id") != client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    """
    List all API access records for a specific client.

    Path params:
        - client_id: The client company ID
    """
    try:
        result = await client_service.get_api_access_by_client(db, client_id)
        return {"data": result}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )


@router.get(
    "/{access_id}",
    response_model=ApiAccessRead,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def get_api_access(
    access_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Get a single API access record by ID.
    """
    try:
        result = await client_service.get_api_access_by_id(db, access_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API access record not found",
        )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API access record not found",
        )
    return result


@router.put(
    "/{access_id}",
    response_model=ApiAccessRead,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def update_api_access(
    access_id: str,
    body: ApiAccessUpdate,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Update an API access record (pricing, limits, status, expiry).

    Body (all optional):
        - success_price_per_hit, not_found_price_per_hit, price_per_hit
        - currency, request_limit, limit_frequency
        - status, expiry_date, api_key
    """
    result = await client_service.update_api_access(db, access_id, body.model_dump(exclude_unset=True))
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API access record not found",
        )
    return result


@router.delete(
    "/{access_id}",
    response_model=BaseResponse,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def delete_api_access(
    access_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Remove an API access record.
    """
    try:
        result = await client_service.delete_api_access(db, access_id)
        return result
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API access record not found",
        )


@router.post(
    "/{access_id}/regenerate-key",
    responses={200: {"description": "New API key generated"}, 404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def regenerate_api_key(
    access_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Generate a new API key for an access record.

    The old key is immediately invalidated.
    """
    try:
        new_key = await client_service.regenerate_api_key(db, access_id)
        return {"success": True, "api_key": new_key}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API access record not found",
        )