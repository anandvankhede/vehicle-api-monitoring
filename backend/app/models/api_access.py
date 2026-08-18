"""
API Access Model — Client API Subscriptions
============================================

Collection: **api_access**

Represents an API that has been assigned to a client with specific
pricing, request limits, and an API key.

Document Structure:
    {
        "_id": ObjectId,
        "client_id": ObjectId,              # references clients._id
        "api_name": str,                    # e.g., "API 1"
        "status": str,                      # "Active" | "Suspended" | "Expired"
        "api_key": str,                     # unique key for authentication
        "price_per_hit": float,
        "success_price_per_hit": float,
        "not_found_price_per_hit": float,
        "currency": str,                    # "INR" | "USD" | "EUR" | "GBP"
        "request_limit": int,
        "limit_frequency": str,             # "Per Minute" | "Per Hour" | "Per Day" | ...
        "current_usage": int,               # default 0
        "expiry_date": datetime,            # optional
        "assigned_at": datetime,
        "assigned_by": str,
        "updated_at": datetime,
    }

Indexes:
    - Unique compound index on (client_id, api_name)
    - Unique index on api_key
"""

COLLECTION_NAME = "api_access"
