"""
Pydantic Schemas Package
========================

This package defines Pydantic models that serve as the API contract:
    - Request schemas  : Validate incoming JSON payloads
    - Response schemas : Format outgoing responses (e.g., convert _id → id)

Schemas:
    - auth.py      : Login, token, and user-identity response schemas
    - client.py    : Client, ClientUser, ApiRequest, ClientApiAccess, etc.
    - common.py    : Reusable fields (pagination, base responses)
    - dashboard.py : Dashboard summary, user API stats, monitoring stats
    - report.py    : Daily/monthly reports, usage summaries, invoices
    - settings.py  : Profile, password, and notification schemas
"""
