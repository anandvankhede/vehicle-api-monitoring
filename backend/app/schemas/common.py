"""
Common Pydantic Schemas
=======================

Reusable schemas that are shared across multiple API modules.

Included:
    - PaginationMetadata: Standard pagination info for list endpoints
    - PaginatedResponse: Generic wrapper for paginated list responses
    - BaseResponse: Simple success/message response wrapper
    - ErrorResponse: Standard error response shape
"""

from pydantic import BaseModel, Field
from typing import Generic, TypeVar, List, Optional

T = TypeVar("T")


class PaginationMetadata(BaseModel):
    """
    Metadata for paginated responses.

    Attributes:
        page:     Current page number (1-based).
        limit:    Number of items per page.
        total:    Total number of items across all pages.
        has_more: Whether there are more pages available.
    """

    page: int = 1
    limit: int = 50
    total: int = 0
    has_more: bool = False


class PaginatedResponse(BaseModel, Generic[T]):
    """
    A generic wrapper for paginated list responses.

    Example:
        {
            "data": [ ... items ... ],
            "pagination": { "page": 1, "limit": 50, "total": 100, "has_more": true }
        }
    """

    data: List[T]
    pagination: PaginationMetadata


class BaseResponse(BaseModel):
    """
    Simple success response with an optional message.

    Example:
        { "success": true, "message": "Resource deleted successfully." }
    """

    success: bool = True
    message: Optional[str] = None


class ErrorResponse(BaseModel):
    """
    Standard error response body.

    Example:
        { "success": false, "error": "Resource not found" }
    """

    success: bool = False
    error: str
