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
from app.services.api_collections import PAN_RESPONSE_COLLECTIONS


class Database:
    """
    Singleton-style wrapper around the Motor async MongoDB client.

    A single AsyncIOMotorClient is created when the application starts
    and reused for all subsequent database operations. This avoids the
    overhead of creating a new connection pool per request.
    """

    client: Optional[AsyncIOMotorClient] = None
    pan_client: Optional[AsyncIOMotorClient] = None

    def connect(self) -> AsyncIOMotorClient:
        """
        Establish connections to MongoDB.

        The main app database uses MONGO_URL. When PAN_MONGO_URL is set, the
        pan (API response) database uses its own connection string — typically
        a remote cluster with separate credentials.
        """
        if self.client is None:
            self.client = AsyncIOMotorClient(settings.MONGO_URL)
            print(f"[OK] Connected to MongoDB at {settings.MONGO_URL}")

        if settings.PAN_MONGO_URL and self.pan_client is None:
            self.pan_client = AsyncIOMotorClient(settings.PAN_MONGO_URL)
            parsed = urlparse(settings.PAN_MONGO_URL)
            host = parsed.hostname or "unknown"
            print(f"[OK] Connected to PAN MongoDB at {host}")

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

    def get_pan_db(self):
        """
        Return the Motor database instance for API-response data (`pan`).

        Uses PAN_MONGO_URL when configured; otherwise falls back to the main
        MongoDB connection with PAN_DATABASE_NAME.
        """
        if settings.PAN_MONGO_URL:
            if self.pan_client is None:
                raise RuntimeError(
                    "PAN MongoDB client is not connected. "
                    "Make sure 'db_manager.connect()' was called at startup."
                )
            return self.pan_client[settings.PAN_DATABASE_NAME]

        if self.client is None:
            raise RuntimeError(
                "Database client is not connected. "
                "Make sure 'db_manager.connect()' was called at startup."
            )
        return self.client[settings.PAN_DATABASE_NAME]

    def close(self) -> None:
        """Close MongoDB connections."""
        if self.pan_client is not None:
            self.pan_client.close()
            self.pan_client = None
            print("[OK] PAN MongoDB connection closed.")
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


async def get_pan_database():
    """
    FastAPI dependency that provides the API-response database (`pan`).

    Returns:
        AsyncIOMotorDatabase instance for the pan (response) database.
    """
    return db_manager.get_pan_db()


async def verify_pan_database() -> None:
    """
    Confirm the external `pan` database already exists and has the expected
    collections. The monitoring app must only READ from pan — never create
    databases, collections, or indexes there (MongoDB creates them on write).
    """
    pan_db = db_manager.get_pan_db()
    db_name = settings.PAN_DATABASE_NAME

    try:
        collections = await pan_db.list_collection_names()
    except Exception as exc:
        raise RuntimeError(
            f"[FATAL] Cannot access PAN database '{db_name}': {exc}. "
            f"Check PAN_MONGO_URL and PAN_DATABASE_NAME."
        ) from exc

    missing = [c for c in PAN_RESPONSE_COLLECTIONS if c not in collections]
    if missing:
        raise RuntimeError(
            f"[FATAL] PAN database '{db_name}' is missing collections: "
            f"{', '.join(missing)}. "
            f"Found: {', '.join(collections) or '(none — database may not exist)'}. "
            f"This app only maps to an existing pan database and will not create it."
        )

    print(
        f"[OK] PAN database '{db_name}' verified "
        f"({len(PAN_RESPONSE_COLLECTIONS)} collections, read-only)"
    )


async def ensure_app_indexes(db) -> None:
    """
    Create/verify indexes on the application database only (`vehical_api_monitoring`).

    Idempotent — safe to run on every startup. Never touches the pan database.
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


