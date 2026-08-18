"""
API Info Model — Available APIs
===============================

Collection: **apis**

Defines the catalog of APIs that clients can request access to.
These are the master list of available services.

Document Structure:
    {
        "_id": ObjectId,
        "name": str,           # e.g., "API 1"
        "description": str,    # e.g., "Real-time vehicle information lookup."
        "category": str,       # "vehicle", "garage", "payment", "insurance", "valuation"
        "is_active": bool,     # default True
        "created_at": datetime,
    }
"""

COLLECTION_NAME = "apis"
