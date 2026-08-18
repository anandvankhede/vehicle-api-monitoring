"""
Business Logic Services Package
===============================

Each module encapsulates the business logic for one domain.
Services are where validation, aggregation, and data-transformation
happen — keeping routers thin and focused on HTTP concerns.

Services:
    - auth_service.py       : Token generation, login verification
    - client_service.py     : Client CRUD, status toggling, usage calculation
    - api_access_service.py : API access management (assign, regenerate key, etc.)
    - api_request_service.py: API request tracking, approval workflow
    - dashboard_service.py  : Dashboard aggregations (stats, analytics, usage)
    - report_service.py     : Report generation (daily, monthly, invoices)
"""
