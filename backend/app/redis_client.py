"""
Redis Connection Manager
========================

Async Redis client for live API gateway client profiles (client:{api_key} hashes).
Connection is optional — the app starts even if Redis is unreachable.
"""

from typing import Optional

import redis.asyncio as redis

from app.config import settings

REDIS_CLIENT_KEY_PREFIX = "client:"


class RedisManager:
    client: Optional[redis.Redis] = None
    ready: bool = False

    def connect(self) -> None:
        if not settings.REDIS_CLIENT_PROFILE_ENABLED:
            print("[INFO] Redis client profiles disabled (REDIS_CLIENT_PROFILE_ENABLED=false).")
            return
        if not settings.REDIS_URL:
            print("[WARN] REDIS_URL not set — client profile sync to Redis is disabled.")
            return
        if self.client is not None:
            return
        self.client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
        print(f"[OK] Redis configured for client profiles ({settings.REDIS_URL})")

    async def verify(self) -> bool:
        if self.client is None:
            self.ready = False
            return False
        try:
            await self.client.ping()
            self.ready = True
            print("[OK] Redis connection verified.")
            return True
        except Exception as exc:
            self.ready = False
            print(f"[WARN] Redis not reachable: {exc}. Client profile sync will be skipped.")
            return False

    def get_client(self) -> Optional[redis.Redis]:
        return self.client

    async def close(self) -> None:
        if self.client is not None:
            await self.client.aclose()
            self.client = None
            self.ready = False
            print("[OK] Redis connection closed.")


redis_manager = RedisManager()


async def get_redis():
    """FastAPI dependency — returns Redis client or None if disabled/unavailable."""
    return redis_manager.get_client()
