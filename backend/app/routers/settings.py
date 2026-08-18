"""
Settings Router
===============

Endpoints:
    - GET /settings/profile        — Get current user profile
    - PUT /settings/profile        — Update user profile
    - PUT /settings/password       — Change password
    - GET /settings/notifications  — Get notification preferences
    - PUT /settings/notifications  — Update notification preferences
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import get_database
from app.dependencies.auth import get_current_admin
from app.schemas.settings import (
    ProfileResponse,
    ProfileUpdateRequest,
    PasswordUpdateRequest,
    NotificationSettings,
    NotificationResponse,
)
from app.schemas.common import BaseResponse, ErrorResponse
from app.utils.security import verify_password, hash_password

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get(
    "/profile",
    response_model=ProfileResponse,
    responses={401: {"model": ErrorResponse}},
)
async def get_profile(
    db=Depends(get_database),
    user=Depends(get_current_admin),
):
    """
    Get the current admin user's profile.
    """
    return {
        "id": user.get("id", ""),
        "username": user.get("username", ""),
        "name": user.get("name", user.get("username", "")),
        "email": user.get("email"),
        "role": user.get("role", "admin"),
    }


@router.put(
    "/profile",
    response_model=ProfileResponse,
    responses={401: {"model": ErrorResponse}},
)
async def update_profile(
    body: ProfileUpdateRequest,
    db=Depends(get_database),
    user=Depends(get_current_admin),
):
    """
    Update the current admin user's profile.

    Body (all optional):
        - name:  Display name
        - email: Email address
    """
    update_data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}

    if update_data:
        from datetime import datetime, timezone
        await db["users"].update_one(
            {"_id": user["_id"]},
            {"$set": {**update_data, "updated_at": datetime.now(timezone.utc)}}
        )

    # Return updated profile
    updated = await db["users"].find_one({"_id": user["_id"]})
    return {
        "id": str(updated["_id"]),
        "username": updated.get("username", ""),
        "name": updated.get("name", updated.get("username", "")),
        "email": updated.get("email"),
        "role": updated.get("role", "admin"),
    }


@router.put(
    "/password",
    response_model=BaseResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def update_password(
    body: PasswordUpdateRequest,
    db=Depends(get_database),
    user=Depends(get_current_admin),
):
    """
    Change the current user's password.

    Body:
        - current_password: The current password
        - new_password:     The new password (min 8 chars)
    """
    # Verify current password
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Hash and update the new password
    from datetime import datetime, timezone
    new_hash = hash_password(body.new_password)
    await db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.now(timezone.utc)}}
    )

    return BaseResponse(success=True, message="Password updated successfully.")


@router.get(
    "/notifications",
    response_model=NotificationResponse,
    responses={401: {"model": ErrorResponse}},
)
async def get_notifications(
    db=Depends(get_database),
    user=Depends(get_current_admin),
):
    """
    Get the current user's notification preferences.
    """
    user_doc = await db["users"].find_one({"_id": user["_id"]})
    prefs = user_doc.get("notification_settings", {}) if user_doc else {}
    return {
        "email_notifications": prefs.get("email_notifications", True),
        "slack_notifications": prefs.get("slack_notifications", False),
        "webhook_url": prefs.get("webhook_url"),
    }


@router.put(
    "/notifications",
    response_model=NotificationResponse,
    responses={401: {"model": ErrorResponse}},
)
async def update_notifications(
    body: NotificationSettings,
    db=Depends(get_database),
    user=Depends(get_current_admin),
):
    """
    Update the current user's notification preferences.

    Body:
        - email_notifications: Enable/disable email notifications
        - slack_notifications: Enable/disable Slack notifications
        - webhook_url:         Optional webhook URL for notifications
    """
    from datetime import datetime, timezone
    settings_data = body.model_dump()
    await db["users"].update_one(
        {"_id": user["_id"]},
        {"$set": {"notification_settings": settings_data, "updated_at": datetime.now(timezone.utc)}}
    )
    return settings_data