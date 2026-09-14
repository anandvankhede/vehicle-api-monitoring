"""
Dynamic API ↔ Response Collection Mapping
=========================================

Response database collections are discovered at runtime. Each API response
store follows the naming convention:

    MongoDB collection: result_{api_name}
    Application api_name: strip the ``result_`` prefix

Collection names are cached briefly (RESPONSE_DB_COLLECTION_CACHE_SECONDS)
to avoid calling list_collection_names() on every dashboard request.
"""

from __future__ import annotations

import re
import time
from typing import Dict, List, Optional, Set, Tuple

from app.config import settings

RESULT_COLLECTION_PREFIX = "result_"

# api_name -> collection_name (only for non-standard response_db collection names)
API_COLLECTION_OVERRIDES: Dict[str, str] = {}

# Lowercase snake_case application API names (maps to result_{api_name} on response_db).
_CATALOG_API_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*$")

_collection_cache: Optional[Tuple[float, List[str]]] = None


def is_catalog_api_name(api_name: str) -> bool:
    """
    True when api_name is a valid application API identifier.

    Catalog entries and client assignments use this name; the response database
    stores responses in collection ``result_{api_name}`` when that collection exists.
    """
    if not api_name or api_name == "all":
        return False
    if len(api_name) > 100:
        return False
    return bool(_CATALOG_API_NAME_RE.match(api_name.strip()))


def is_response_collection(collection_name: str) -> bool:
    """True when the collection name looks like a response_db API response store."""
    return bool(collection_name) and collection_name.startswith(RESULT_COLLECTION_PREFIX)


def api_name_from_collection(collection_name: str) -> Optional[str]:
    """Derive application api_name from a response_db collection name."""
    if collection_name in _override_collection_to_api():
        return _override_collection_to_api()[collection_name]
    if not is_response_collection(collection_name):
        return None
    api_name = collection_name[len(RESULT_COLLECTION_PREFIX):]
    return api_name or None


def collection_for_api_name(api_name: str) -> Optional[str]:
    """Map application api_name to its response_db collection name."""
    if not api_name or api_name == "all":
        return None
    if api_name in API_COLLECTION_OVERRIDES:
        return API_COLLECTION_OVERRIDES[api_name]
    return f"{RESULT_COLLECTION_PREFIX}{api_name}"


def get_response_collection_for_api(api_name: str) -> Optional[str]:
    """Return the response_db collection for an application api_name."""
    return collection_for_api_name(api_name)


def _override_collection_to_api() -> Dict[str, str]:
    return {coll: name for name, coll in API_COLLECTION_OVERRIDES.items()}


def _collections_from_names(names: List[str]) -> List[str]:
    live = {name for name in names if is_response_collection(name)}
    live.update(API_COLLECTION_OVERRIDES.values())
    return sorted(live)


async def get_live_response_collections(
    response_db, *, force_refresh: bool = False,
) -> List[str]:
    """Return response_db collection names that currently exist (cached)."""
    global _collection_cache

    if response_db is None:
        return []

    ttl = max(0, settings.RESPONSE_DB_COLLECTION_CACHE_SECONDS)
    now = time.monotonic()
    if (
        not force_refresh
        and ttl > 0
        and _collection_cache is not None
        and (now - _collection_cache[0]) < ttl
    ):
        return list(_collection_cache[1])

    try:
        names = await response_db.list_collection_names()
    except Exception:
        if _collection_cache is not None:
            return list(_collection_cache[1])
        return []

    live = _collections_from_names(names)
    if ttl > 0:
        _collection_cache = (now, live)
    return live


async def get_live_response_api_names(response_db) -> List[str]:
    """Return application api_names for all live response_db collections."""
    collections = await get_live_response_collections(response_db)
    existing = set(collections)
    api_names: Set[str] = set()
    for coll in collections:
        name = api_name_from_collection(coll)
        if name:
            api_names.add(name)
    for api_name, coll in API_COLLECTION_OVERRIDES.items():
        if coll in existing:
            api_names.add(api_name)
    return sorted(api_names)


async def get_live_api_collection_map(response_db) -> Dict[str, str]:
    """Return {api_name: collection_name} for all live response_db APIs."""
    collections = await get_live_response_collections(response_db)
    existing = set(collections)
    result: Dict[str, str] = {}
    for coll in collections:
        name = api_name_from_collection(coll)
        if name:
            result[name] = coll
    for api_name, coll in API_COLLECTION_OVERRIDES.items():
        if coll in existing:
            result[api_name] = coll
    return result


async def is_live_response_db_api(api_name: str, response_db=None) -> bool:
    """True when api_name has a matching collection on the response_db right now."""
    if not is_catalog_api_name(api_name):
        return False
    if response_db is None:
        return collection_for_api_name(api_name) is not None
    live = set(await get_live_response_api_names(response_db))
    return api_name in live


async def is_valid_api_name(api_name: str, response_db=None) -> bool:
    """Alias for live response_db check (used by analytics query endpoints)."""
    return await is_live_response_db_api(api_name, response_db)


_catalog_names_cache: Optional[Tuple[float, str, List[str]]] = None


async def get_catalog_api_names(db, *, active_only: bool = False) -> List[str]:
    """Return API names registered in the application catalog (source of truth)."""
    global _catalog_names_cache
    ttl = max(0, settings.RESPONSE_DB_COLLECTION_CACHE_SECONDS)
    cache_key = "active" if active_only else "all"
    now = time.time()

    if (
        ttl > 0
        and _catalog_names_cache is not None
        and _catalog_names_cache[1] == cache_key
        and (now - _catalog_names_cache[0]) < ttl
    ):
        return list(_catalog_names_cache[2])

    query: dict = {}
    if active_only:
        query["is_active"] = True
    docs = await db["apis"].find(query, {"name": 1}).to_list(length=None)
    names = sorted(
        doc["name"] for doc in docs
        if doc.get("name") and is_catalog_api_name(doc["name"])
    )
    if ttl > 0:
        _catalog_names_cache = (now, cache_key, names)
    return names


async def is_registered_api_name(db, api_name: str, response_db=None) -> bool:
    """
    True when the API exists in the application catalog.

    Catalog is the source of truth for API Management and client assignment.
    Response_db collection ``result_{api_name}`` is linked when it exists.
    """
    if not is_catalog_api_name(api_name):
        return False
    return bool(await db["apis"].find_one({"name": api_name}, {"_id": 1}))
