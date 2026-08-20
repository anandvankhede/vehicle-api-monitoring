#!/usr/bin/env python3
"""
Create recommended indexes on response_db result_* collections.

Run from the backend directory:
    python scripts/ensure_response_db_indexes.py

Uses RESPONSE_MONGO_URL and RESPONSE_DATABASE_NAME from the environment / .env.
"""

from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.services.api_collections import get_live_response_collections


async def main() -> None:
    if not settings.RESPONSE_MONGO_URL:
        print("RESPONSE_MONGO_URL is not set — nothing to do.")
        return

    client = AsyncIOMotorClient(settings.RESPONSE_MONGO_URL)
    db = client[settings.RESPONSE_DATABASE_NAME]
    collections = await get_live_response_collections(db)
    if not collections:
        print("No result_* collections found.")
        return

    for coll_name in collections:
        coll = db[coll_name]
        await coll.create_index(
            [("access_key", 1), ("created_time", 1)],
            name="access_key_created_time",
            background=True,
        )
        await coll.create_index(
            [("created_time", 1)],
            name="created_time",
            background=True,
        )
        print(f"[OK] indexes ensured on {coll_name}")

    client.close()
    print(f"Done — {len(collections)} collection(s) processed.")


if __name__ == "__main__":
    asyncio.run(main())
