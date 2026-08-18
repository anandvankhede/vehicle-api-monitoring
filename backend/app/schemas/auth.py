"""
Authentication Schemas
======================

Pydantic models for authentication endpoints (login, token response, etc.).

The admin login endpoint accepts username + password and returns
a JWT access token plus the user's identity.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    """
    Request body for POST /auth/login.

    Users provide either "username" or "email" along with "password".
    """

    username: str = Field(..., min_length=1, description="Username or email")
    password: str = Field(..., min_length=1, description="User password")


class ClientLoginRequest(BaseModel):
    """
    Request body for POST /auth/client-login.
    Clients log in with their username and password (stored in client_users).
    """

    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class UserIdentity(BaseModel):
    """
    The user identity embedded in login responses and JWT tokens.
    """

    id: str
    username: str
    name: str
    role: str
    avatar: Optional[str] = None


class ClientIdentity(BaseModel):
    """
    The client identity embedded in client-login responses and JWT tokens.
    """

    id: str            # client_user _id
    client_id: str     # the company they belong to
    username: str
    company_name: str


class TokenResponse(BaseModel):
    """
    Standard JWT login response for admin users.

    Example:
        {
            "access_token": "eyJhbGciOiJIUzI1NiIs...",
            "token_type": "bearer",
            "user": {
                "id": "1",
                "username": "admin",
                "name": "Admin User",
                "role": "admin"
            }
        }
    """

    access_token: str
    token_type: str = "bearer"
    user: UserIdentity


class ClientTokenResponse(BaseModel):
    """
    JWT login response for client users.

    Example:
        {
            "access_token": "eyJhbGciOiJIUzI1NiIs...",
            "token_type": "bearer",
            "client": {
                "id": "<client_user_id>",
                "client_id": "<company_id>",
                "username": "acme_user",
                "company_name": "Acme Motors"
            }
        }
    """

    access_token: str
    token_type: str = "bearer"
    client: ClientIdentity


class RefreshRequest(BaseModel):
    """
    Request body for POST /auth/refresh.
    Clients send their (still-valid-enough) token to get a fresh one.
    """

    refresh_token: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    """Request body for POST /auth/forgot-password."""
    email: str


class ResetPasswordRequest(BaseModel):
    """Request body for POST /auth/reset-password."""
    token: str
    new_password: str
