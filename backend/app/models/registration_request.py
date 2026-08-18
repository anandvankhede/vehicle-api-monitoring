"""
Registration Request Model — Pending Registrations
===================================================

Collection: **registration_requests**

Tracks new client registration submissions before they are approved
by an admin. Created automatically when a client registers.

Document Structure:
    {
        "_id": ObjectId,
        "client_id": ObjectId,           # references clients._id
        "company_name": str,
        "email": str,
        "phone": str,
        "requested_apis": [str],         # list of API names requested
        "submitted_date": datetime,      # ISO timestamp string
        "status": str,                   # "Pending" | "Approved" | "Changes Required"
        "reason": str,                   # optional, admin feedback
    }
"""

COLLECTION_NAME = "registration_requests"
