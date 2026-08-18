"""
User Model — Admin Users
========================

Collection: **users**

Stores administrator accounts that log into the admin dashboard.
These are separate from client users (see client_user.py).

Document Structure:
    {
        "_id": ObjectId,
        "username": str,        # unique
        "email": str,           # unique
        "password_hash": str,   # bcrypt hash
        "role": str,            # "admin", "viewer", "editor"
        "is_active": bool,      # default True
        "created_at": datetime,
        "updated_at": datetime,
    }
"""

# Collection name used throughout services and routers.
COLLECTION_NAME = "users"

# Fields that should NOT be returned to the frontend (sensitive data).
SENSITIVE_FIELDS = ["password_hash"]
