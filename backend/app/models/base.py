"""
Base Model Utilities
====================

Shared helpers for working with MongoDB documents in Motor.

Because Motor returns raw dicts (not typed objects), we need small
helper functions to:
    1. Convert MongoDB's "_id" (ObjectId) to a string "id" field.
    2. Recursively clean nested ObjectIds from sub-documents.

Every model module imports `serialize_document` from here to ensure
consistent _id → id conversion across all API responses.
"""

from typing import Any, Dict
from bson import ObjectId


def serialize_document(doc: Any) -> Any:
    """
    Convert a MongoDB document (or list of documents) into a format
    suitable for JSON responses.

    - Converts "_id" (ObjectId) to "id" (string).
    - Recursively applies to nested dicts and lists.

    Args:
        doc: A MongoDB document (dict), a list of documents, or a scalar.

    Returns:
        The same structure with all ObjectId values converted to strings.
    """
    if doc is None:
        return None

    # Handle lists of documents
    if isinstance(doc, list):
        return [serialize_document(item) for item in doc]

    # Handle dicts — the main case for MongoDB documents
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            # Rename _id → id and convert ObjectId to string
            if key == "_id" and isinstance(value, ObjectId):
                result["id"] = str(value)
            else:
                result[key] = serialize_document(value)
        return result

    # Convert bare ObjectId (not a dict)
    if isinstance(doc, ObjectId):
        return str(doc)

    # Scalars (str, int, float, bool, datetime, etc.) pass through
    return doc


def to_object_id(id_str: str):
    """
    Safely convert a string ID to a MongoDB ObjectId.

    Args:
        id_str: A string representation of a MongoDB ObjectId.

    Returns:
        An ObjectId instance, or None if the string is invalid.
    """
    try:
        return ObjectId(id_str)
    except (TypeError, ValueError):
        return None
