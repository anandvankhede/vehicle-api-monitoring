"""
Redis API list key mapping
==========================

Maps catalog ``api_name`` values (MongoDB / admin UI) to gateway tokens stored
in Redis ``api_list`` (comma-separated), e.g. ``rc_to_mob,fastag_01``.

MongoDB ``api_access.api_name`` and ``user_mapping.apis`` are unchanged.
Only the Redis profile ``api_list`` field uses the mapped keys.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional

from bson import ObjectId

_REDIS_API_KEY_RE = re.compile(r"^[a-z][a-z0-9_]*$")

# Catalog api_name -> Redis gateway key when they differ (optional defaults).
DEFAULT_REDIS_API_KEY_ALIASES: Dict[str, str] = {
    "rc_to_mobile": "rc_to_mob",
    "rc_data": "rc_to_data",
    "chassis_to_rc": "chassis_to_rc_no",
}


def is_valid_redis_api_key(value: str) -> bool:
    if not value or len(value) > 100:
        return False
    return bool(_REDIS_API_KEY_RE.match(value.strip()))


def normalize_redis_api_key(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text:
        return None
    if not is_valid_redis_api_key(text):
        raise ValueError(
            f"Invalid Redis API key '{text}'. Use lowercase letters, numbers, and underscores."
        )
    return text


async def load_redis_key_map(db, api_names: List[str]) -> Dict[str, str]:
    """Batch-load redis_api_key from catalog for the given application api names."""
    if not api_names:
        return {}
    unique = list({n for n in api_names if n})
    cursor = db["apis"].find(
        {"name": {"$in": unique}},
        {"name": 1, "redis_api_key": 1},
    )
    mapping: Dict[str, str] = {}
    async for doc in cursor:
        name = doc.get("name")
        redis_key = doc.get("redis_api_key")
        if name and redis_key:
            mapping[name] = str(redis_key).strip()
    return mapping


def resolve_redis_api_key(
    api_name: str,
    catalog_map: Optional[Dict[str, str]] = None,
) -> str:
    """
    Resolve one catalog api_name to its Redis gateway key.

    Priority: catalog ``redis_api_key`` field -> default aliases -> api_name.
    """
    if not api_name:
        return ""
    name = api_name.strip()
    catalog_map = catalog_map or {}
    if name in catalog_map and catalog_map[name]:
        return catalog_map[name]
    return DEFAULT_REDIS_API_KEY_ALIASES.get(name, name)


async def map_api_names_to_redis_keys(db, api_names: List[str]) -> List[str]:
    """Map assigned catalog names to unique Redis gateway keys (order preserved)."""
    catalog_map = await load_redis_key_map(db, api_names)
    result: List[str] = []
    seen: set[str] = set()
    for name in api_names:
        redis_key = resolve_redis_api_key(name, catalog_map)
        if redis_key and redis_key not in seen:
            result.append(redis_key)
            seen.add(redis_key)
    return result


async def build_redis_api_list_string(db, client_id) -> str:
    """Comma-separated Redis api_list for a client's active API assignments."""
    from app.services.redis_client_profile_service import collect_active_api_names

    if isinstance(client_id, str):
        client_id = ObjectId(client_id)
    names = await collect_active_api_names(db, client_id)
    keys = await map_api_names_to_redis_keys(db, names)
    return ",".join(keys)


async def resync_redis_api_list_for_api_name(db, api_name: str) -> int:
    """Re-sync Redis api_list for every client that has this API assigned."""
    from app.services.redis_client_profile_service import sync_redis_api_list

    client_ids: set = set()
    cursor = db["api_access"].find(
        {"api_name": api_name, "status": "Active"},
        {"client_id": 1},
    )
    async for row in cursor:
        if row.get("client_id"):
            client_ids.add(row["client_id"])

    synced = 0
    for client_id in client_ids:
        if await sync_redis_api_list(db, client_id):
            synced += 1
    return synced
