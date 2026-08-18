"""
API Request Model — Access Requests
===================================

Collection: **api_requests**

Tracks requests from clients to gain access to additional APIs.
An admin reviews these requests and can approve or reject them.

Document Structure:
    {
        "_id": ObjectId,
        "client_id": ObjectId,     # references clients._id
        "api_name": str,           # e.g., "API 1"
        "status": str,             # "Pending Approval" | "Approved" | "Rejected"
        "requested_at": datetime,
        "reviewed_at": datetime,   # set when approved or rejected
        "reason": str,             # rejection reason (optional)
    }
"""

COLLECTION_NAME = "api_requests"
