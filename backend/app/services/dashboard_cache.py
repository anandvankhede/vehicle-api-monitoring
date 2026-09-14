"""
In-process API catalog cache for analytics aggregations.

Dashboard response TTL caching is handled in the frontend only — nothing is
stored in Redis for dashboard data. Client profile keys in Redis are unchanged.
"""

from __future__ import annotations

import time
from typing import Optional, Tuple

from app.config import settings

_catalog_docs_cache: Optional[Tuple[float, list]] = None


async def get_catalog_api_documents_cached(db) -> list:
    """Cached full API catalog documents (avoids repeated reads within TTL)."""
    global _catalog_docs_cache
    ttl = max(0, int(getattr(settings, "DASHBOARD_CATALOG_CACHE_SECONDS", 120)))
    if ttl <= 0:
        return await db["apis"].find().to_list(length=None)

    now = time.monotonic()
    if _catalog_docs_cache and (now - _catalog_docs_cache[0]) < ttl:
        return list(_catalog_docs_cache[1])

    docs = await db["apis"].find().to_list(length=None)
    _catalog_docs_cache = (now, docs)
    return docs
