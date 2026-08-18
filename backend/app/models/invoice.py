"""
Invoice Model — Billing Invoices
=================================

Collection: **invoices**

Stores generated invoices for clients. Each invoice covers a
billing period and includes per-API usage breakdowns.

Document Structure:
    {
        "_id": ObjectId,
        "invoice_number": str,           # unique, e.g., "INV-202408-ab12cd"
        "client_id": ObjectId,           # references clients._id
        "client_name": str,
        "company_name": str,
        "invoice_date": str,             # ISO date string "2024-08-01"
        "billing_period_start": str,
        "billing_period_end": str,
        "api_wise_usage": [               # array of usage items
            {
                "api_name": str,
                "success_requests": int,
                "not_found_requests": int,
                "success_cost": float,
                "not_found_cost": float,
                "total_cost": float,
            }
        ],
        "subtotal": float,
        "gst_percentage": float,         # default 18
        "gst_amount": float,
        "grand_total": float,
        "currency": str,                 # default "INR"
        "status": str,                   # "pending" | "paid" | "overdue"
        "created_at": datetime,
    }
"""

COLLECTION_NAME = "invoices"
