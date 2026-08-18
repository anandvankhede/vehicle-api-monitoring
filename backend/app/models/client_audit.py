"""
Client Audit Model — Client-Specific Audit Entries
===================================================

Collection: **client_audit**

Logs actions that affect a specific client. More granular than
activity_records — these are administrative audit entries.

Document Structure:
    {
        "_id": ObjectId,
        "client_id": ObjectId,       # references clients._id
        "action": str,               # e.g., "API Approved", "Password Reset"
        "details": str,              # human-readable description
        "admin_username": str,       # who performed the action
        "timestamp": datetime,       # ISO timestamp string
    }
"""

COLLECTION_NAME = "client_audit"
