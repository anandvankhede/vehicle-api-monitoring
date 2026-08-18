"""
API Routers Package
===================

Each module in this package defines a FastAPI APIRouter with endpoints
for one feature area. The routers are imported and registered in main.py.

Routers:
    - auth.py        : Authentication (login, logout, refresh, password)
    - client.py      : Client CRUD + activate/deactivate
    - client_user.py : Client user CRUD + reset password
    - api_request.py : API access request CRUD + approve/reject
    - api_access.py  : Client API subscription CRUD + regenerate key
    - api_info.py    : Available APIs listing
    - dashboard.py   : Dashboard stats, analytics, recent activity, API usage
    - report.py      : Usage reports (daily, monthly, summary, table, export)
    - settings.py    : User profile, password, and notification settings
    - registration.py: Registration request management
"""

# ============================================================================
# Router module imports
# ============================================================================
# These are imported so that main.py can do:
#     from app.routers import auth, client, ...
# Without this, Python would still resolve submodule imports, but this makes
# the dependencies explicit.

from app.routers import auth
from app.routers import client
from app.routers import client_user
from app.routers import api_request
from app.routers import api_access
from app.routers import api_info
from app.routers import dashboard
from app.routers import report
from app.routers import registration
from app.routers import activity
from app.routers import audit_log

# Note: "settings" is intentionally NOT imported here at module level
# because it conflicts with app.config.settings in main.py.
# Use: from app.routers import settings as settings_router  (in main.py)

__all__ = [
    "auth",
    "client",
    "client_user",
    "api_request",
    "api_access",
    "api_info",
    "dashboard",
    "report",
    "registration",
    "activity",
    "audit_log",
]
