"""
Read-only PAN / response database access with load limits.

All monitoring reads should go through these helpers so we:
  - cap concurrent queries (avoid hammering shared Mongo)
  - enforce query timeouts (maxTimeMS)
  - never write to the response database
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from app.config import settings

_semaphore: Optional[asyncio.Semaphore] = None


def _query_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        limit = max(1, settings.RESPONSE_DB_MAX_CONCURRENT_QUERIES)
        _semaphore = asyncio.Semaphore(limit)
    return _semaphore


def query_max_ms() -> Optional[int]:
    ms = settings.RESPONSE_DB_QUERY_MAX_MS
    return ms if ms and ms > 0 else None


def aggregate_kwargs() -> Dict[str, Any]:
    opts: Dict[str, Any] = {}
    ms = query_max_ms()
    if ms:
        opts["maxTimeMS"] = ms
    return opts


@asynccontextmanager
async def pan_read_slot():
    """Limit how many PAN queries run at the same time."""
    async with _query_semaphore():
        yield


async def pan_aggregate(collection, pipeline: list) -> List[dict]:
    """Run a read-only aggregation with timeout and concurrency limits."""
    async with pan_read_slot():
        try:
            cursor = collection.aggregate(pipeline, **aggregate_kwargs())
            return await cursor.to_list(length=None)
        except Exception:
            return []


async def pan_count_documents(collection, match: dict) -> int:
    async with pan_read_slot():
        try:
            kwargs: Dict[str, Any] = {}
            ms = query_max_ms()
            if ms:
                kwargs["maxTimeMS"] = ms
            return await collection.count_documents(match, **kwargs)
        except Exception:
            return 0


async def pan_find_to_list(
    collection,
    match: dict,
    projection: dict,
    *,
    sort=None,
    limit: Optional[int] = None,
    hint=None,
    batch_size: int = 1000,
) -> List[dict]:
    async with pan_read_slot():
        try:
            cursor = collection.find(match, projection)
            if sort is not None:
                cursor = cursor.sort(sort)
            if limit is not None:
                cursor = cursor.limit(limit)
            if hint is not None:
                cursor = cursor.hint(hint)
            ms = query_max_ms()
            if ms:
                cursor = cursor.max_time_ms(ms)
            cursor = cursor.batch_size(batch_size)
            return await cursor.to_list(length=limit)
        except Exception:
            return []
