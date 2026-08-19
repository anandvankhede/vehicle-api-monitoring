"""
Database Connection Manager
============================

This module provides the MongoDB connection management for the entire backend.
It uses Motor (the async MongoDB driver) to support FastAPI's async endpoints.

Usage:
    from app.database import get_database
    db = await get_database()  # Returns the Motor database instance

Developer Notes:
    - The connection is established once at application startup and reused.
    - Motor's AsyncIOMotorClient is thread-safe and can be shared across requests.
    - The database instance is cached on the `db` attribute to avoid reconnects.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
from urllib.parse import urlparse

from app.config import settings
from app.services.api_collections import RESPONSE_COLLECTIONS


def _mask_mongo_url(url: str) -> str:
    """Return host:port/db for logs — never print credentials."""
    try:
        parsed = urlparse(url)
        host = parsed.hostname or "unknown"
        port = f":{parsed.port}" if parsed.port else ""
        db = (parsed.path or "").strip("/") or settings.RESPONSE_DATABASE_NAME
        return f"{host}{port}/{db}"
    except Exception:
        return "(invalid URI)"


def response_db_connection_label() -> str:
    """Human-readable response DB target for log messages."""
    if settings.RESPONSE_MONGO_URL:
        return f"RESPONSE_MONGO_URL -> {_mask_mongo_url(settings.RESPONSE_MONGO_URL)}"
    return (
        f"MONGO_URL fallback -> {_mask_mongo_url(settings.MONGO_URL)} "
        f"(database: {settings.RESPONSE_DATABASE_NAME}). "
        f"Set RESPONSE_MONGO_URL to your remote response database cluster."
    )


class Database:
    """
    Singleton-style wrapper around the Motor async MongoDB client.

    A single AsyncIOMotorClient is created when the application starts
    and reused for all subsequent database operations. This avoids the
    overhead of creating a new connection pool per request.
    """

    client: Optional[AsyncIOMotorClient] = None
    response_client: Optional[AsyncIOMotorClient] = None
    response_db_ready: bool = False

    def connect(self) -> AsyncIOMotorClient:
        """
        Establish connections to MongoDB.

        The main app database uses MONGO_URL. When RESPONSE_MONGO_URL is set, the
        API response database uses its own connection string — typically
        a remote cluster with separate credentials.
        """
        if self.client is None:
            self.client = AsyncIOMotorClient(settings.MONGO_URL)
            print(f"[OK] Connected to MongoDB at {settings.MONGO_URL}")

        if settings.RESPONSE_MONGO_URL and self.response_client is None:
            self.response_client = AsyncIOMotorClient(settings.RESPONSE_MONGO_URL)
            print(
                f"[OK] Response DB MongoDB configured: {_mask_mongo_url(settings.RESPONSE_MONGO_URL)} "
                f"(db: {settings.RESPONSE_DATABASE_NAME})"
            )
        elif not settings.RESPONSE_MONGO_URL:
            print(
                f"[WARN] RESPONSE_MONGO_URL not set - using app MongoDB for response data "
                f"({settings.RESPONSE_DATABASE_NAME}). Set RESPONSE_MONGO_URL for production."
            )

        return self.client

    def get_db(self):
        """
        Return the Motor database instance for the configured database name.

        Returns:
            AsyncIOMotorDatabase instance.
        """
        if self.client is None:
            raise RuntimeError(
                "Database client is not connected. "
                "Make sure 'await db_manager.connect()' was called at startup."
            )
        return self.client[settings.DATABASE_NAME]

    def get_response_db(self):
        """
        Return the Motor database instance for raw API-response data.

        Uses RESPONSE_MONGO_URL when configured; otherwise falls back to the main
        MongoDB connection with RESPONSE_DATABASE_NAME.
        """
        if settings.RESPONSE_MONGO_URL:
            if self.response_client is None:
                raise RuntimeError(
                    "Response DB MongoDB client is not connected. "
                    "Make sure 'db_manager.connect()' was called at startup."
                )
            return self.response_client[settings.RESPONSE_DATABASE_NAME]

        if self.client is None:
            raise RuntimeError(
                "Database client is not connected. "
                "Make sure 'db_manager.connect()' was called at startup."
            )
        return self.client[settings.RESPONSE_DATABASE_NAME]

    def close(self) -> None:
        """Close MongoDB connections."""
        if self.response_client is not None:
            self.response_client.close()
            self.response_client = None
            print("[OK] Response DB MongoDB connection closed.")
        if self.client is not None:
            self.client.close()
            self.client = None
            print("[OK] MongoDB connection closed.")


# Global singleton instance — import this in your routes/services.
# Example:  from app.database import db_manager
db_manager = Database()


async def get_database():
    """
    FastAPI dependency that provides the MongoDB database.

    Use this as a dependency in any route that needs DB access:
        @app.get("/items")
        async def get_items(db = Depends(get_database)):
            result = await db["items"].find().to_list(None)
            return result

    Returns:
        AsyncIOMotorDatabase instance for the configured database.
    """
    return db_manager.get_db()


async def get_response_database():
    """
    FastAPI dependency that provides the API-response database.

    Returns:
        AsyncIOMotorDatabase instance for the response database.
    """
    return db_manager.get_response_db()


async def verify_response_database() -> bool:
    """
    Check whether the external response database is reachable and has mapped
    collections. Never creates response DB databases/collections. On failure,
    logs a warning and returns False — the app still starts (graphs stay empty).
    """
    db_manager.response_db_ready = False
    response_db = db_manager.get_response_db()
    db_name = settings.RESPONSE_DATABASE_NAME
    target = response_db_connection_label()

    try:
        collections = await response_db.list_collection_names()
    except Exception as exc:
        print(
            f"[WARN] Response database '{db_name}' not accessible ({target}): {exc}. "
            f"App will start without response analytics."
        )
        return False

    missing = [c for c in RESPONSE_COLLECTIONS if c not in collections]
    if missing:
        print(
            f"[WARN] Response database '{db_name}' is not fully available.\n"
            f"  Connection: {target}\n"
            f"  Missing collections: {', '.join(missing)}\n"
            f"  Found: {', '.join(collections) or '(none)'}\n"
            f"  App will start - dashboard response data will be empty until configured."
        )
        return False

    db_manager.response_db_ready = True
    print(
        f"[OK] Response database '{db_name}' verified "
        f"({len(RESPONSE_COLLECTIONS)} collections, read-only) - {target}"
    )
    return True


async def ensure_app_indexes(db) -> None:
    """
    Create/verify indexes on the application database only (`vehical_api_monitoring`).

    Idempotent — safe to run on every startup. Never touches the response database.
    """
    await db["api_access"].create_index(
        [("client_id", 1), ("api_name", 1)],
        unique=True,
        name="uq_api_access_client_api",
    )
    await db["api_access"].create_index(
        [("api_key", 1)], name="idx_api_access_api_key"
    )
    await db["user_mapping"].create_index(
        [("client_id", 1)], unique=True, name="uq_user_mapping_client_id"
    )
    await db["user_mapping"].create_index(
        [("username", 1)], name="idx_user_mapping_username"
    )


async def ensure_indexes(db) -> None:
    """Backward-compatible alias — app indexes only."""
    await ensure_app_indexes(db)

