"""
Client Management Router
========================

Endpoints:
    - GET    /clients                     — List all clients
    - POST   /clients                     — Create a client
    - GET    /clients/{id}                — Get a client detail
    - PUT    /clients/{id}                — Update a client
    - DELETE /clients/{id}                — Soft-delete a client
    - POST   /clients/{id}/activate       — Activate a client
    - POST   /clients/{id}/deactivate     — Deactivate a client
    - GET    /clients/{id}/activity       — Client activity feed
    - GET    /clients/{id}/apis           — Client's API subscription status
    - GET    /clients/{id}/usage          — Client usage summary
    - GET    /clients/{id}/billing        — Client billing summary
    - GET    /clients/{id}/audit          — Client audit history
    - POST   /clients/{id}/reset-password — Reset client password
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional, List

from bson import ObjectId

from app.database import get_database
from app.dependencies.auth import get_current_admin, get_current_client, get_current_user
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientRead,
    ClientListResponse,
    PasswordResetRequest,
    ClientUsageSummary,
    ClientBillingSummary,
    ClientApiProfileCreate,
    ClientApiProfileUpdate,
    ClientApiProfileRead,
)
from app.schemas.common import BaseResponse, ErrorResponse, PaginationMetadata
from app.services.client_service import ClientService

router = APIRouter(prefix="/clients", tags=["Client Management"])

client_service = ClientService()


@router.get(
    "",
    response_model=ClientListResponse,
    responses={401: {"model": ErrorResponse}},
)
async def list_clients(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    List all clients (admin only).

    Query params:
        - skip:  Number of records to skip for pagination (default 0)
        - limit: Max records per page (default 100, max 500)
    """
    result = await client_service.get_all_clients(db, skip=skip, limit=limit)
    return {
        "data": result["data"],
        "total": result["total"],
        "pagination": PaginationMetadata(
            page=(skip // limit) + 1 if limit > 0 else 1,
            limit=limit,
            total=result["total"],
            has_more=(skip + limit) < result["total"],
        ),
    }


@router.post(
    "",
    response_model=ClientRead,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def create_client(
    body: ClientCreate,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Create a new client company.

    Body:
        - company_name, username, password, address, gstin, pan, email, phone
    """
    try:
        result = await client_service.create_client(db, body.model_dump())
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/me",
    response_model=ClientRead,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def get_own_client(
    db=Depends(get_database),
    client=Depends(get_current_client),
):
    """
    Get the current client's own data.
    Used by client users to view their company profile.
    """
    client_id = client.get("client_id")
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    try:
        result = await client_service.get_client_by_id(db, client_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    result.pop("visible_password", None)
    return result


@router.get(
    "/{client_id}",
    response_model=ClientRead,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def get_client(
    client_id: str,
    db=Depends(get_database),
    user=Depends(get_current_admin),
):
    """
    Get a single client by ID.
    Admin can access any client. Clients can access their own data.
    """
    try:
        result = await client_service.get_client_by_id(db, client_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    return result


@router.put(
    "/{client_id}",
    response_model=ClientRead,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def update_client(
    client_id: str,
    body: ClientUpdate,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Update a client. Only provided fields are updated.
    """
    result = await client_service.update_client(db, client_id, body.model_dump(exclude_unset=True))
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    return result


@router.delete(
    "/{client_id}",
    response_model=BaseResponse,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def delete_client(
    client_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Soft-delete a client by setting its status to "Inactive".
    """
    try:
        result = await client_service.delete_client(db, client_id)
        return result
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )


@router.post(
    "/{client_id}/activate",
    response_model=ClientRead,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def activate_client(
    client_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Activate a client account.
    """
    doc = await client_service.update_client_status(db, client_id, "Active")
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    from app.services.client_service import _serialize
    return _serialize(doc)


@router.post(
    "/{client_id}/deactivate",
    response_model=ClientRead,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def deactivate_client(
    client_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Deactivate a client account.
    """
    doc = await client_service.update_client_status(db, client_id, "Inactive")
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    from app.services.client_service import _serialize
    return _serialize(doc)


# ============================================================================
# Client-specific sub-resources
# ============================================================================

@router.get(
    "/{client_id}/activity",
    responses={401: {"model": ErrorResponse}},
)
async def get_client_activity(
    client_id: str,
    db=Depends(get_database),
    user=Depends(get_current_user),
):
    """
    Get a client's activity feed (admin or the client themselves).
    """
    if user.get("type") == "client" and user.get("client_id") != client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    try:
        result = await client_service.get_client_activity(db, client_id)
        return {"data": result}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )


@router.get(
    "/{client_id}/apis",
    responses={401: {"model": ErrorResponse}},
)
async def get_client_apis(
    client_id: str,
    db=Depends(get_database),
    user=Depends(get_current_user),
):
    # Clients can only see their own API subscriptions
    if user.get("type") == "client" and user.get("client_id") != client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    """
    Get a client's API subscription status.

    Returns a list of all available APIs with their status for this client:
    - "Active": Client has access
    - "Pending Approval": Client has requested access
    - "Not Assigned": Client does not have access
    """
    client = await db["clients"].find_one({"_id": ObjectId(client_id)})
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    # Get all APIs from catalog
    apis = await db["apis"].find().to_list(length=None)
    api_info = [
        {"id": str(a["_id"]), "name": a["name"], "description": a.get("description", ""), "category": a.get("category", "vehicle")}
        for a in apis
    ]

    # Get client's active/pending API names
    active_access = await db["api_access"].find({"client_id": ObjectId(client_id), "status": "Active"}).to_list(length=None)
    active_names = set(a["api_name"] for a in active_access)
    active_names.update(client.get("selected_apis", []))

    suspended_access = await db["api_access"].find({"client_id": ObjectId(client_id), "status": "Suspended"}).to_list(length=None)
    suspended_names = set(a["api_name"] for a in suspended_access)

    pending_requests = await db["api_requests"].find({"client_id": ObjectId(client_id), "status": "Pending Approval"}).to_list(length=None)
    pending_names = set(r["api_name"] for r in pending_requests)

    result = []
    for api in api_info:
        if api["name"] in active_names:
            status_val = "Active"
        elif api["name"] in suspended_names:
            status_val = "Suspended"
        elif api["name"] in pending_names:
            status_val = "Pending Approval"
        else:
            status_val = "Not Assigned"
        result.append({
            "api": api,
            "status": status_val,
        })

    return {"data": result}


@router.get(
    "/{client_id}/usage",
    response_model=List[ClientUsageSummary],
    responses={401: {"model": ErrorResponse}},
)
async def get_client_usage(
    client_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Get a client's per-API usage summary.
    """
    try:
        result = await client_service.get_client_usage(db, client_id)
        return result
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )


@router.get(
    "/{client_id}/billing",
    response_model=ClientBillingSummary,
    responses={401: {"model": ErrorResponse}},
)
async def get_client_billing(
    client_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Get a client's billing summary.
    """
    try:
        result = await client_service.get_billing_summary(db, client_id)
        return result
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )


@router.get(
    "/{client_id}/audit",
    responses={401: {"model": ErrorResponse}},
)
async def get_client_audit(
    client_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Get a client's audit history (admin view).
    """
    try:
        result = await client_service.get_audit_history(db, client_id)
        return {"data": result}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )


@router.get(
    "/{client_id}/api-profile",
    response_model=ClientApiProfileRead,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def get_client_api_profile(
    client_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """Get universal API key profile for a client (if created)."""
    result = await client_service.get_api_profile(db, client_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API profile not found for this client",
        )
    return result


@router.post(
    "/{client_id}/api-profile",
    response_model=ClientApiProfileRead,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def create_client_api_profile(
    client_id: str,
    body: ClientApiProfileCreate,
    db=Depends(get_database),
    admin=Depends(get_current_admin),
):
    """
    Create universal API key + daily request limit for a client.
    Writes Redis hash at client:{api_key} with empty api_list.
    """
    try:
        assigned_by = admin.get("username", "admin")
        return await client_service.create_api_profile(
            db, client_id, body.request_limit, assigned_by
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put(
    "/{client_id}/api-profile",
    response_model=ClientApiProfileRead,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def update_client_api_profile(
    client_id: str,
    body: ClientApiProfileUpdate,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """Update daily request limit, API key, and/or Redis profile status (active/inactive)."""
    try:
        return await client_service.update_api_profile(
            db,
            client_id,
            request_limit=body.request_limit,
            api_key=body.api_key,
            status=body.status,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{client_id}/reset-password",
    response_model=BaseResponse,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def reset_client_password(
    client_id: str,
    body: PasswordResetRequest,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Reset a client's password (admin-initiated).

    Body:
        - new_password: The new password (min 8 chars)
    """
    # Find the client's user
    user = await db["client_users"].find_one({"client_id": ObjectId(client_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client user not found",
        )

    from app.utils.security import hash_password
    from datetime import datetime, timezone

    await db["client_users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(body.new_password), "updated_at": datetime.now(timezone.utc)}}
    )

    await db["clients"].update_one(
        {"_id": ObjectId(client_id)},
        {"$set": {"visible_password": body.new_password, "updated_at": datetime.now(timezone.utc)}},
    )

    # Log audit
    await db["client_audit"].insert_one({
        "client_id": ObjectId(client_id),
        "action": "Password Reset",
        "details": "Client password was reset by administrator",
        "admin_username": "admin",
        "timestamp": datetime.now(timezone.utc),
    })

    return BaseResponse(success=True, message="Password reset successfully.")