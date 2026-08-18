"""
Helper Functions
=================

This module contains generic utility functions used across the backend.
These helpers keep the route and service code clean and DRY.

Functions:
    - generate_api_key()  : Generate a unique, URL-safe API key for clients.
    - format_id()         : Convert a MongoDB ObjectId to a string (or handle None).
    - parse_date_string() : Parse an ISO date string, returning None on failure.
    - utc_now_iso()       : Return the current UTC time as an ISO string.
"""

import secrets
from datetime import datetime, timezone
from typing import Optional, Any


def generate_api_key() -> str:
    """
    Generate a unique, secure API key.

    The key is 64 hex characters (256 bits of entropy), making it
    suitable for use as a client API key.

    Returns:
        A string like 'ffcdbb12c6bfa20d2846f5cb175772f3accb1dee3cc473477f531d12532e652c'
    """
    return secrets.token_hex(32)


def format_id(obj_id: Any) -> Optional[str]:
    """
    Convert a MongoDB ObjectId (or any object) to a string.

    In MongoDB documents, the '_id' field is stored as an ObjectId.
    When sending data to the frontend, we need it as a plain string.

    Args:
        obj_id: An ObjectId, string, or None.

    Returns:
        The string representation, or None if obj_id is None.
    """
    if obj_id is None:
        return None
    return str(obj_id)


def parse_date_string(date_str: Optional[str]) -> Optional[datetime]:
    """
    Parse an ISO 8601 date string into a datetime object.

    Args:
        date_str: An ISO-format date string (e.g., "2024-01-15" or
                  "2024-01-15T10:30:00").

    Returns:
        A datetime object, or None if the string is invalid or None.
    """
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def utc_now_iso() -> str:
    """
    Return the current UTC time as an ISO 8601 string.

    Returns:
        A string like '2024-08-05T14:30:00.123456+00:00'.
    """
    return datetime.now(timezone.utc).isoformat()
