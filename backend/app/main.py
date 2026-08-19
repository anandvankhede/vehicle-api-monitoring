"""
Vehicle API Monitoring — FastAPI Application Entry Point
========================================================

This is the main application file. It creates the FastAPI app,
registers all routers, configures CORS, and sets up the database
connection lifecycle (connect on startup, close on shutdown).

Run with:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 5000
"""

import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import db_manager, ensure_app_indexes, verify_response_database
from app.utils.api_catalog import ensure_api_catalog
from app.routers import (
    auth,
    client,
    client_user,
    api_request,
    api_access,
    api_info,
    dashboard,
    report,
    analytics,
    settings as settings_router,
    activity,
    audit_log,
)

# ============================================================================
# FastAPI Application Instance
# ============================================================================

app = FastAPI(
    title="Vehicle API Monitoring System",
    description="""
    Backend API for the Vehicle API Monitoring dashboard.
    
    Features:
        - Admin & Client authentication (JWT)
        - Client company management
        - API access request & approval workflow
        - API key generation & rotation
        - Usage tracking & billing
        - Dashboard analytics
        - Usage reports & invoice generation
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ============================================================================
# CORS Configuration
# ============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Return JSON for unexpected errors so CORS middleware can attach headers.
    Without this, some 500s surface in the browser as generic CORS failures.
    """
    print(f"[ERROR] Unhandled exception on {request.method} {request.url.path}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# ============================================================================
# Root Endpoint
# ============================================================================

@app.get("/")
async def root():
    """
    Health check endpoint — verifies the server is running.
    """
    return {
        "status": "ok",
        "service": "Vehicle API Monitoring",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint — verifies DB connectivity.
    """
    try:
        db = db_manager.get_db()
        await db.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "disconnected"},
        )


# ============================================================================
# Router Registration
# ============================================================================

# All API routes are prefixed with /api to match the frontend's API_BASE_URL
app.include_router(auth.router, prefix="/api")
app.include_router(client.router, prefix="/api")
app.include_router(client_user.router, prefix="/api")
app.include_router(api_request.router, prefix="/api")
app.include_router(api_access.router, prefix="/api")
app.include_router(api_info.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(report.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(activity.router, prefix="/api")
app.include_router(audit_log.router, prefix="/api")


# ============================================================================
# Lifecycle Events
# ============================================================================

@app.on_event("startup")
async def startup():
    """Connect to MongoDB, check response DB (non-fatal), ensure app indexes."""
    print(f"[OK] CORS allowed origins: {', '.join(settings.FRONTEND_ORIGINS)}")
    db_manager.connect()
    await verify_response_database()
    try:
        db = db_manager.get_db()
        await ensure_app_indexes(db)
        seeded = await ensure_api_catalog(db)
        if seeded:
            print(f"[OK] API catalog bootstrapped ({seeded} new entries)")
    except Exception as exc:  # pragma: no cover - non-fatal
        print(f"[WARN] App startup setup warning: {exc}")


@app.on_event("shutdown")
async def shutdown():
    """Close MongoDB connection on shutdown."""
    db_manager.close()