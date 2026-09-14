"""
Client Model — Client Companies
===============================

Collection: **clients**

Stores company information for each registered client.
A client has an associated client_user (the person who logs in).

Document Structure:
    {
        "_id": ObjectId,
        "username": str,           # unique, e.g. "acme_motors"
        "company_name": str,
        "address": str,
        "gstin": str,              # Indian tax ID (15 chars)
        "pan": str,                # Indian PAN (10 chars)
        "email": str,
        "phone": str,
        "selected_apis": [str],    # list of API names assigned
        "comments": str,
        "request_status": str,     # "Pending" | "Approved"
        "status": str,             # "Active" | "Inactive"
        "api_key": str,            # universal API key (one per client)
        "request_limit": int,      # daily limit (Per Day)
        "current_usage": int,      # mirrors Redis "used"
        "api_profile_assigned_by": str,
        "api_profile_created_at": datetime,
        "created_at": datetime,
        "updated_at": datetime,
    }
"""

COLLECTION_NAME = "clients"

# Fields to exclude from API responses (sensitive or redundant).
EXCLUDE_FIELDS = ["password_hash"]
