"""
Client User Model
=================

Collection: **client_users**

Stores login credentials for the person associated with a client company.
Each client company typically has one client_user.

Document Structure:
    {
        "_id": ObjectId,
        "client_id": ObjectId,     # references clients._id
        "username": str,           # unique
        "password_hash": str,      # bcrypt hash
        "role": str,               # "CLIENT"
        "status": str,             # "Active" | "Inactive"
        "created_at": datetime,
        "updated_at": datetime,
    }
"""

COLLECTION_NAME = "client_users"

# Sensitive fields to never return in API responses.
SENSITIVE_FIELDS = ["password_hash"]
