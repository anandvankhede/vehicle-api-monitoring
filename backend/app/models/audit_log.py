"""
Audit Log Model — Admin Audit Logs
==================================

Collection: **audit_logs**

Logs administrative actions performed by admins.
This is system-wide (not tied to a specific client).

Document Structure:
    {
        "_id": ObjectId,
        "admin_username": str,    # who performed the action
        "action": str,            # e.g., "API Approved", "Client Created"
        "details": str,           # human-readable description
        "timestamp": datetime,    # when the action occurred
    }
"""

COLLECTION_NAME = "audit_logs"
