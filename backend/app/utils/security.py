"""
Security Utilities
===================

This module provides all security-related functions for the backend:
    - Password hashing and verification (using bcrypt via passlib)
    - JWT token creation (access tokens)
    - JWT token verification (extracting user identity)

Developer Notes:
    - Passwords are hashed with bcrypt (via passlib) — NEVER store plain-text passwords.
    - JWT tokens are signed with HS256 and expire after ACCESS_TOKEN_EXPIRE_MINUTES.
    - The SECRET_KEY must be kept secure — rotate it in production.
    - Token payloads include the user's ID, username, role, and a "type" field
      (either "admin" or "client") so the auth dependency can distinguish them.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings


# ---------------------------------------------------------------------------
# Password Hashing
# ---------------------------------------------------------------------------
# CryptContext provides a unified interface to password hashing algorithms.
# We configure it to use bcrypt with automatic hash detection.
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",          # Automatically upgrade old hash formats
    bcrypt__rounds=12,          # Work factor — higher = more secure but slower
)


def hash_password(password: str) -> str:
    """
    Hash a plain-text password using bcrypt.

    Args:
        password: The plain-text password to hash.

    Returns:
        A bcrypt hash string (e.g., "$2b$12$...").
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain-text password against a stored bcrypt hash.

    Args:
        plain_password:  The password the user just typed.
        hashed_password: The stored bcrypt hash from the database.

    Returns:
        True if the password matches the hash, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------------------------
# JWT Token Management
# ---------------------------------------------------------------------------

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token.

    Args:
        data:          A dictionary of claims to embed in the token.
                       Must include "sub" (subject — typically the user ID).
                       The caller should also include "username", "role",
                       and "type" (either "admin" or "client").
        expires_delta: Optional custom expiration. If None, uses
                       settings.ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns:
        A compact JWT string (three Base64 segments separated by dots).

    Example:
        token = create_access_token({
            "sub": "user123",
            "username": "admin",
            "role": "admin",
            "type": "admin",
        })
    """
    to_encode = data.copy()

    # Determine token expiration time
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify a JWT access token and extract its payload.

    Args:
        token: The JWT string from the Authorization header.

    Returns:
        The decoded token payload (a dict of claims) if valid,
        or None if the token is expired, invalid, or tampered with.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return payload
    except JWTError:
        # This catches expired tokens, invalid signatures, etc.
        return None


def decode_token_unsafe(token: str) -> Dict[str, Any]:
    """
    Decode a JWT WITHOUT verifying the signature (for debugging only).

    ⚠️  WARNING: Never use this for authentication decisions.
    Only use verify_token() for production auth flows.
    """
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"verify_signature": False},
    )
