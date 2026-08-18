"""
Database Dependency
===================

This module provides a FastAPI dependency that yields the MongoDB
database instance. It is used in route handlers to get the database
connection for read/write operations.

Usage in a route:
    from app.dependencies.database import get_db

    @router.get("/items")
    async def list_items(db = Depends(get_db)):
        docs = await db["items"].find().to_list(None)
        return docs
"""

from typing import AsyncGenerator
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database import db_manager


async def get_db() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    """
    FastAPI dependency: yield the MongoDB database instance.

    Yields:
        AsyncIOMotorDatabase — the configured database for this app.

    This function uses an async generator so FastAPI can manage
    resource lifecycle cleanly (even though Motor needs no cleanup
    per-request — the client is shared globally).
    """
    yield db_manager.get_db()
