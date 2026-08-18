"""
Authentication Dependency
=========================

This module provides FastAPI dependencies for JWT-based authentication.
It is used in route handlers to protect endpoints and extract the
current user's identity from the request.

Two user types are supported:
    1. Admin users  — stored in the "users" collection (role-based access)
    2. Client users — stored in the "client_users" collection

Usage in a route:
    from app.dependencies.auth import get_current_admin, get_current_client

    @router.get("/protected")
    async def protected_route(user = Depends(get_current_admin)):
        return {"message": f"Hello {user.username}"}
"""

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import get_database as get_db  # re-export so routes can import from here
from app.utils.security import verify_token
from bson import ObjectId


# ---------------------------------------------------------------------------
# Token extraction
# ---------------------------------------------------------------------------
# HTTPBearer reads the Authorization header: "Bearer <token>"
bearer_scheme = HTTPBearer(auto_error=False)


async def get_token_credentials(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[str]:
    """
    Extract the bearer token from the Authorization header.

    If no token is provided, returns None (allows optional auth routes).
    If a token is provided but malformed, raises 401.

    Returns:
        The raw JWT token string, or None if no Authorization header.
    """
    if credentials is None:
        return None
    return credentials.credentials


def _verify_and_decode(token: str) -> dict:
    """
    Verify the JWT token and return its payload.

    Raises:
        HTTPException(401): If the token is missing, invalid, or expired.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


# ---------------------------------------------------------------------------
# Admin user dependency
# ---------------------------------------------------------------------------

async def get_current_admin(
    token: Optional[str] = Depends(get_token_credentials),
    db=Depends(get_db),
) -> dict:
    """
    FastAPI dependency: authenticate the current admin user.

    Verifies the JWT token, then looks up the admin user in the
    "users" collection to confirm the account exists and is active.

    Returns:
        The admin user document (dict) with "id" instead of "_id".

    Raises:
        HTTPException(401): If the token is invalid or the user is not found.
    """
    payload = _verify_and_decode(token)
    user_type = payload.get("type", "admin")

    if user_type != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = await db["users"].find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # Convert _id to id string for downstream use
    user["id"] = str(user.pop("_id"))
    return user


# ---------------------------------------------------------------------------
# Client user dependency
# ---------------------------------------------------------------------------

async def get_current_client(
    token: Optional[str] = Depends(get_token_credentials),
    db=Depends(get_db),
) -> dict:
    """
    FastAPI dependency: authenticate the current client user.

    Verifies the JWT token, then looks up the client user in the
    "client_users" collection to confirm the account is active.

    Returns:
        The client user document (dict) with "id" and "client_id"
        as strings.

    Raises:
        HTTPException(401): If the token is invalid or the client user is not found.
    """
    payload = _verify_and_decode(token)
    user_type = payload.get("type", "client")

    if user_type != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client access required",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = await db["client_users"].find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Client user not found",
        )

    if user.get("status") != "Active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    user["id"] = str(user.pop("_id"))
    user["client_id"] = str(user.get("client_id"))
    return user


# ---------------------------------------------------------------------------
# Combined admin-or-client dependency (for endpoints both roles can use)
# ---------------------------------------------------------------------------

async def get_current_user(
    token: Optional[str] = Depends(get_token_credentials),
    db=Depends(get_db),
) -> dict:
    """
    FastAPI dependency: authenticate either an admin or a client user.
    """
    payload = _verify_and_decode(token)
    user_type = payload.get("type", "admin")

    if user_type == "admin":
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
        user = await db["users"].find_one({"_id": ObjectId(user_id)})
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        if not user.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )
        user["id"] = str(user.pop("_id"))
        user["type"] = "admin"
        return user
    elif user_type == "client":
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
        user = await db["client_users"].find_one({"_id": ObjectId(user_id)})
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Client user not found",
            )
        if user.get("status") != "Active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive",
            )
        user["id"] = str(user.pop("_id"))
        user["client_id"] = str(user.get("client_id"))
        user["type"] = "client"
        return user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied",
    )


# ---------------------------------------------------------------------------
# Optional auth (for endpoints that work with or without auth)
# ---------------------------------------------------------------------------

async def get_current_user_optional(
    token: Optional[str] = Depends(get_token_credentials),
    db=Depends(get_db),
) -> Optional[dict]:
    """
    FastAPI dependency: return the current user if authenticated, None otherwise.

    Use this for endpoints that can serve public data but return
    additional info when the user is logged in.
    """
    if token is None:
        return None
    try:
        return await get_current_admin(token=token, db=db)
    except HTTPException:
        return None
