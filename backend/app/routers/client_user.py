"""
Client Users Router
===================

Endpoints:
    - GET    /client-users          — List all client users (admin view)
    - POST   /client-users          — Create a client user
    - GET    /client-users/{id}     — Get a client user detail
    - PUT    /client-users/{id}     — Update a client user
    - DELETE /client-users/{id}     — Delete a client user
    - POST   /client-users/{id}/reset-password — Reset a client user's password
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import get_database
from app.dependencies.auth import get_current_admin
from app.schemas.client import (
    ClientUserCreate,
    ClientUserUpdate,
    ClientUserRead,
    PasswordResetRequest,
)
from app.schemas.common import BaseResponse, ErrorResponse, PaginationMetadata
from app.services.client_service import ClientService

router = APIRouter(prefix="/client-users", tags=["Client Users"])

client_service = ClientService()


@router.get(
    "",
    responses={401: {"model": ErrorResponse}},
)
async def list_client_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    List all client users (admin only).
    """
    result = await client_service.get_all_client_users(db, skip=skip, limit=limit)
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
    response_model=ClientUserRead,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def create_client_user(
    body: ClientUserCreate,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Create a new client user account.

    Body:
        - client_id: The parent client company's ID
        - username:  Login username
        - password:  Login password (min 8 chars)
        - role:      Default "CLIENT"
    """
    try:
        result = await client_service.create_client_user(db, body.model_dump())
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/{user_id}",
    response_model=ClientUserRead,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def get_client_user(
    user_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Get a single client user by ID.
    """
    try:
        result = await client_service.get_client_user_by_id(db, user_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client user not found",
        )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client user not found",
        )
    return result


@router.put(
    "/{user_id}",
    response_model=ClientUserRead,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def update_client_user(
    user_id: str,
    body: ClientUserUpdate,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Update a client user's username, role, or status.
    """
    result = await client_service.update_client_user(db, user_id, body.model_dump(exclude_unset=True))
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client user not found",
        )
    return result


@router.delete(
    "/{user_id}",
    response_model=BaseResponse,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def delete_client_user(
    user_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Delete a client user.
    """
    try:
        result = await client_service.delete_client_user(db, user_id)
        return result
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client user not found",
        )


@router.post(
    "/{user_id}/reset-password",
    response_model=BaseResponse,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def reset_client_user_password(
    user_id: str,
    body: PasswordResetRequest,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Reset a client user's password (admin-initiated).

    Body:
        - new_password: The new password (min 8 chars)
    """
    try:
        result = await client_service.reset_client_password(db, user_id, body.new_password)
        return result
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client user not found",
        )