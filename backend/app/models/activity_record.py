"""
Activity Record Model — Client Activity Feed
============================================

Collection: **activity_records**

A chronological log of actions affecting a specific client.
Shown on the client activity page and client details page.

Document Structure:
    {
        "_id": ObjectId,
        "client_id": ObjectId,     # references clients._id
        "type": str,               # "Company Registration" | "API Request" | "Profile Update"
        "title": str,              # e.g., "API 1", "Company Registration"
        "status": str,             # "Submitted" | "Under Review" | "Approved" | "Changes Required" | "Pending Approval"
        "message": str,            # human-readable description
        "date": datetime,          # ISO timestamp string
        "reason": str,             # optional, for "Changes Required"
        "api_name": str,           # optional, for API Request type
        "action": str,             # optional, "Request Again" | "Edit Company Details"
    }
"""

COLLECTION_NAME = "activity_records"
