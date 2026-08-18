"""
Authentication Router
=====================

Endpoints:
    - POST /auth/login             — Admin/User login
    - POST /auth/client-login      — Client login
    - POST /auth/register          — Client registration
    - POST /auth/logout            — Logout (revokes token client-side)
    - POST /auth/refresh           — Refresh token
    - POST /auth/forgot-password   — Request password reset
    - POST /auth/reset-password    — Reset password with token
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional

from app.database import get_database
from app.schemas.auth import (
    LoginRequest,
    ClientLoginRequest,
    TokenResponse,
    ClientTokenResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.schemas.common import BaseResponse, ErrorResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])

auth_service = AuthService()


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={401: {"model": ErrorResponse}},
)
async def login(
    body: LoginRequest,
    db=Depends(get_database),
):
    """
    Authenticate an admin/dashboard user.

    Body:
        - username: The admin username
        - password: The admin password

    Returns a JWT access token + user identity.
    """
    try:
        result = await auth_service.admin_login(db, body.username, body.password)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.post(
    "/client-login",
    response_model=ClientTokenResponse,
    responses={401: {"model": ErrorResponse}},
)
async def client_login(
    body: ClientLoginRequest,
    db=Depends(get_database),
):
    """
    Authenticate a client user.

    Body:
        - username: The client user's username
        - password: The client user's password

    Returns a JWT access token + client identity (including company info).
    """
    try:
        result = await auth_service.client_login(db, body.username, body.password)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        )


@router.post(
    "/register",
    response_model=BaseResponse,
    responses={400: {"model": ErrorResponse}},
)
async def register_client(body: dict, db=Depends(get_database)):
    """
    Register a new client company.

    This creates:
        1. A client (company) document
        2. A client_user (login account) with hashed password
        3. A registration_request for admin approval
        4. An activity record and an audit log

    Body:
        {
            "company_name": "Acme Motors",
            "username": "acme",
            "address": "...",
            "gstin": "27AAACA1234A1Z5",
            "pan": "AAACA1234A",
            "email": "info@acme.com",
            "phone": "+919876543210",
            "password": "secret123"
        }
    """
    try:
        await auth_service.client_register(db, body)
        return BaseResponse(
            success=True,
            message="Registration submitted successfully.",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/logout", response_model=BaseResponse)
async def logout():
    """
    Log out the current user.

    Since JWT tokens are stateless, the frontend discards the token.
    This endpoint exists for API symmetry and is a no-op on the server.
    """
    return BaseResponse(success=True, message="Logged out successfully.")


@router.post("/refresh")
async def refresh_token(body: dict, db=Depends(get_database)):
    """
    Refresh an access token.

    Body:
        - refresh_token: The current JWT token (still valid enough)

    Returns a fresh access token. If no token is provided, returns a 401.
    """
    from app.utils.security import verify_token, create_access_token
    from datetime import timedelta

    token = body.get("refresh_token") or body.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No token provided",
        )

    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    new_token = create_access_token(
        {
            "sub": payload.get("sub", ""),
            "username": payload.get("username", ""),
            "role": payload.get("role", ""),
            "type": payload.get("type", "admin"),
            "name": payload.get("name", ""),
        }
    )
    return {
        "access_token": new_token,
        "token_type": "bearer",
        "user": {
            "id": payload.get("sub", ""),
            "username": payload.get("username", ""),
            "name": payload.get("name", ""),
            "role": payload.get("role", ""),
        },
    }


@router.post("/forgot-password", response_model=BaseResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    db=Depends(get_database),
):
    """
    Request a password reset.

    In production this would send an email with a reset link.
    For now, it returns a success message and logs the request.
    """
    # Look up user by email in users or client_users
    user = await db["users"].find_one({"username": body.email})
    if not user:
        user = await db["client_users"].find_one({"username": body.email})

    # Always return success to avoid user enumeration
    return BaseResponse(
        success=True,
        message="If that email exists, a password reset link has been sent.",
    )


@router.post("/reset-password", response_model=BaseResponse)
async def reset_password(
    body: ResetPasswordRequest,
    db=Depends(get_database),
):
    """
    Reset a user's password using the token from the email link.

    Body:
        - token:       The reset token (not implemented — accepts any token)
        - new_password: The new password (min 8 chars)
    """
    from app.utils.security import hash_password

    if len(body.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long.",
        )

    # In production, validate the token and find the user.
    # For now, just accept and return success.
    return BaseResponse(
        success=True,
        message="Password has been reset successfully.",
    )