"""
Backfill Redis client profiles from MongoDB.

Usage:
    cd backend
    python -m scripts.sync_redis_client_profiles
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import db_manager
from app.redis_client import redis_manager
from app.services.redis_client_profile_service import sync_redis_client_profile


async def main() -> None:
    db_manager.connect()
    redis_manager.connect()
    ok = await redis_manager.verify()
    if not ok:
        print("[ERROR] Redis not available. Set REDIS_URL and retry.")
        return

    db = db_manager.get_db()
    cursor = db["clients"].find({"api_key": {"$exists": True, "$ne": None}})
    synced = 0
    skipped = 0
    async for client in cursor:
        if not client.get("api_key"):
            skipped += 1
            continue
        success = await sync_redis_client_profile(db, client["_id"])
        if success:
            synced += 1
            print(f"[OK] Synced {client.get('username')} ({client['_id']})")
        else:
            print(f"[WARN] Failed {client.get('username')} ({client['_id']})")

    print(f"Done. synced={synced} skipped={skipped}")
    await redis_manager.close()
    db_manager.close()


if __name__ == "__main__":
    asyncio.run(main())
