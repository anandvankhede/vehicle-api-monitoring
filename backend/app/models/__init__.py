"""
Data Models Package
===================

This package contains the MongoDB document model definitions for each
collection used in the Vehicle API Monitoring system.

Since we use Motor (raw async driver) without a full ODM, these modules
define the canonical field layouts and provide helper functions for
converting between MongoDB documents and Pydantic-compatible dicts.

Models:
    - user.py               : Admin user accounts (users collection)
    - client.py             : Client companies (clients collection)
    - client_user.py        : Per-client user accounts (client_users collection)
    - api_info.py           : Available APIs (apis collection)
    - api_request.py        : API access requests (api_requests collection)
    - api_access.py         : Client API subscriptions (api_access collection)
    - activity_record.py    : Client activity feed (activity_records collection)
    - audit_log.py          : Admin audit logs (audit_logs collection)
    - client_audit.py       : Client-specific audit entries (client_audit collection)
    - registration_request.py : Registration requests (registration_requests collection)
    - invoice.py            : Invoices (invoices collection)
    - usage_report.py       : Pre-computed usage reports (usage_reports collection)
"""
