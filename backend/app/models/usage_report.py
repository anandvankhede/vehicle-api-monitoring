"""
Usage Report Model — Pre-computed Daily Usage
=============================================

Collection: **usage_reports**

Stores daily usage statistics for API requests. These records
are populated from API request logs (api_requests collection).

Document Structure:
    {
        "_id": ObjectId,
        "date": str,                   # ISO date "2024-08-05"
        "client_id": ObjectId,         # optional — if null, it's a system-wide total
        "api_name": str,               # optional
        "success_requests": int,       # default 0
        "failed_requests": int,         # default 0
        "not_found_requests": int,     # default 0
        "total_requests": int,         # default 0
        "revenue": float,              # default 0
        "cost": float,                 # default 0
        "avg_response_time": float,    # default 0
        "created_at": datetime,
    }
"""

COLLECTION_NAME = "usage_reports"
