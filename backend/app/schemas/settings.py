"""
Settings Schemas
================

Pydantic models for user profile, password, and notification settings.

Endpoints:
    - GET/PUT  /settings/profile    — User profile update
    - GET/PUT  /settings/password   — Password change
    - GET/PUT  /settings/notifications — Notification preferences
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional


class ProfileResponse(BaseModel):
    """
    Response for GET /settings/profile.
    Returns admin user profile details.
    """

    id: str
    username: str
    name: str
    email: Optional[str] = None
    role: str


class ProfileUpdateRequest(BaseModel):
    """
    Request body for PUT /settings/profile.
    All fields are optional — only provided fields are updated.
    """

    name: Optional[str] = None
    email: Optional[str] = None


class PasswordUpdateRequest(BaseModel):
    """
    Request body for PUT /settings/password.
    """

    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


class NotificationSettings(BaseModel):
    """
    Notification preferences for the user.
    """

    email_notifications: bool = True
    slack_notifications: bool = False
    webhook_url: Optional[str] = None


class NotificationResponse(BaseModel):
    """Response for GET /settings/notifications."""

    email_notifications: bool
    slack_notifications: bool
    webhook_url: Optional[str] = None
