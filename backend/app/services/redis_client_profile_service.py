"""
Redis Client Profile Service
============================

Syncs one universal client API profile to Redis at key ``client:{api_key}``.

MongoDB ``clients`` is the source of truth for api_key, request_limit, current_usage.
Redis holds live gateway fields including api_list (comma-separated assigned APIs).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId

from app.config import settings
from app.redis_client import REDIS_CLIENT_KEY_PREFIX, redis_manager
from app.utils.helpers import generate_api_key
from app.services.redis_api_key_mapping import build_redis_api_list_string

logger = logging.getLogger(__name__)

LIMIT_FREQUENCY = "Per Day"
PRESERVE_FIELDS = ("used", "lifetimeUsed")
REDIS_STATUS_ACTIVE = "active"
REDIS_STATUS_INACTIVE = "inactive"


def normalize_redis_profile_status(value: Optional[str], default: str = REDIS_STATUS_ACTIVE) -> str:
    """Normalize profile status to lowercase ``active`` or ``inactive`` for Redis."""
    if value is None:
        return default
    text = str(value).strip()
    if not text:
        return default
    lowered = text.lower()
    if lowered in (REDIS_STATUS_ACTIVE, "enabled"):
        return REDIS_STATUS_ACTIVE
    if lowered in (REDIS_STATUS_INACTIVE, "disabled", "suspended"):
        return REDIS_STATUS_INACTIVE
    if text in ("Active", "Inactive"):
        return REDIS_STATUS_ACTIVE if text == "Active" else REDIS_STATUS_INACTIVE
    return default


def resolve_profile_status(client: Dict[str, Any], redis_data: Optional[Dict[str, str]] = None) -> str:
    """
    Resolve API profile status — MongoDB ``api_profile_status`` is authoritative.
    Falls back to Redis, then client account status (Active/Inactive).
    """
    mongo_status = client.get("api_profile_status")
    if mongo_status:
        return normalize_redis_profile_status(mongo_status)

    redis_status = (redis_data or {}).get("status")
    if redis_status:
        return normalize_redis_profile_status(redis_status)

    account_status = client.get("status", "Active")
    return (
        REDIS_STATUS_ACTIVE
        if account_status == "Active"
        else REDIS_STATUS_INACTIVE
    )


def _redis_key(api_key: str) -> str:
    prefix = settings.REDIS_CLIENT_KEY_PREFIX or REDIS_CLIENT_KEY_PREFIX
    return f"{prefix}{api_key}"


async def _get_redis():
    if not settings.REDIS_CLIENT_PROFILE_ENABLED:
        return None
    client = redis_manager.get_client()
    if client is None or not redis_manager.ready:
        return None
    return client


async def collect_active_api_names(db, client_id) -> List[str]:
    names: List[str] = []
    cursor = db["api_access"].find({
        "client_id": client_id,
        "status": "Active",
    })
    async for row in cursor:
        name = row.get("api_name")
        if name and name not in names:
            names.append(name)
    return names


async def _read_preserved_fields(redis_client, key: str) -> Dict[str, str]:
    preserved: Dict[str, str] = {}
    for field in PRESERVE_FIELDS:
        try:
            val = await redis_client.hget(key, field)
            if val is not None:
                preserved[field] = str(val)
        except Exception:
            pass
    return preserved


async def create_client_api_profile(
    db,
    client_id: str,
    request_limit: int,
    assigned_by: str = "admin",
) -> Dict[str, Any]:
    """
    Generate api_key, save on clients document, create Redis hash with empty api_list.
    """
    if request_limit < 1:
        raise ValueError("request_limit must be at least 1.")

    oid = ObjectId(client_id)
    client = await db["clients"].find_one({"_id": oid})
    if not client:
        raise ValueError("Client not found.")
    if client.get("api_key"):
        raise ValueError("Client already has an API key. Use update limit or regenerate instead.")

    api_key = generate_api_key()
    now = datetime.now(timezone.utc)

    await db["clients"].update_one(
        {"_id": oid},
        {"$set": {
            "api_key": api_key,
            "request_limit": request_limit,
            "current_usage": 0,
            "api_profile_status": REDIS_STATUS_ACTIVE,
            "api_profile_created_at": now,
            "api_profile_assigned_by": assigned_by,
            "updated_at": now,
        }},
    )

    await _write_redis_profile(
        db,
        client_id=oid,
        api_key=api_key,
        is_new=True,
        assigned_by=assigned_by,
        api_list="",
    )

    return await build_client_api_profile(db, str(oid))


async def read_redis_client_profile(api_key: str) -> Optional[Dict[str, str]]:
    """Read live Redis hash fields for client:{api_key}."""
    redis_client = await _get_redis()
    if not redis_client or not api_key:
        return None
    try:
        data = await redis_client.hgetall(_redis_key(api_key))
        return data if data else None
    except Exception as exc:
        logger.warning("Failed to read Redis profile for key %s: %s", api_key[:8], exc)
        return None


async def update_client_api_key(db, client_id: str, new_api_key: str) -> Dict[str, Any]:
    """Replace universal api_key in MongoDB, api_access, user_mapping, and Redis."""
    new_api_key = (new_api_key or "").strip()
    if not new_api_key:
        raise ValueError("API key cannot be empty.")
    if len(new_api_key) < 16:
        raise ValueError("API key must be at least 16 characters.")

    oid = ObjectId(client_id)
    client = await db["clients"].find_one({"_id": oid})
    if not client or not client.get("api_key"):
        raise ValueError("Client has no API profile yet.")

    old_key = client["api_key"]
    if old_key == new_api_key:
        return await build_client_api_profile(db, client_id)

    duplicate = await db["clients"].find_one({
        "api_key": new_api_key,
        "_id": {"$ne": oid},
    })
    if duplicate:
        raise ValueError("This API key is already in use by another client.")

    now = datetime.now(timezone.utc)
    await db["clients"].update_one(
        {"_id": oid},
        {"$set": {"api_key": new_api_key, "updated_at": now}},
    )
    await db["api_access"].update_many(
        {"client_id": oid},
        {"$set": {"api_key": new_api_key, "updated_at": now}},
    )

    redis_client = await _get_redis()
    if redis_client:
        try:
            old_data = await redis_client.hgetall(_redis_key(old_key))
            if old_data:
                old_data["client_id"] = str(oid)
                old_data["api_key"] = new_api_key
                await redis_client.hset(_redis_key(new_api_key), mapping=old_data)
            await redis_client.delete(_redis_key(old_key))
        except Exception as exc:
            logger.warning("Redis key migration failed for client %s: %s", client_id, exc)
            await sync_redis_client_profile(db, client_id)
    else:
        await sync_redis_client_profile(db, client_id)

    from app.services.user_mapping_service import update_user_mapping_access_key
    await update_user_mapping_access_key(db, str(oid), new_api_key)

    return await build_client_api_profile(db, client_id)


async def build_client_api_profile(db, client_id: str) -> Dict[str, Any]:
    """Merge MongoDB client profile with live Redis hash fields."""
    if isinstance(client_id, str):
        client_id = ObjectId(client_id)

    client = await db["clients"].find_one({"_id": client_id})
    if not client or not client.get("api_key"):
        raise ValueError("API profile not found for this client.")

    api_key = client["api_key"]
    redis_data = await read_redis_client_profile(api_key) or {}
    redis_api_list = await build_redis_api_list_string(db, client_id)

    def _int_field(name: str, fallback: int = 0) -> int:
        raw = redis_data.get(name)
        if raw is None or raw == "":
            return fallback
        try:
            return int(raw)
        except (TypeError, ValueError):
            return fallback

    return {
        "client_id": redis_data.get("client_id", str(client_id)),
        "api_key": redis_data.get("api_key", api_key),
        "username": redis_data.get("username", client.get("username", "")),
        "status": resolve_profile_status(client, redis_data),
        "used": _int_field("used", int(client.get("current_usage", 0) or 0)),
        "lifetimeUsed": _int_field("lifetimeUsed", 0),
        "limit_frequency": redis_data.get("limit_frequency", LIMIT_FREQUENCY),
        "assigned_by": redis_data.get(
            "assigned_by", client.get("api_profile_assigned_by", "admin")
        ),
        "request_limit": _int_field(
            "request_limit", int(client.get("request_limit", 0) or 0)
        ),
        "api_list": redis_api_list or redis_data.get("api_list", ""),
        "redis_synced": bool(redis_data),
    }


async def update_client_request_limit(
    db,
    client_id: str,
    request_limit: int,
) -> Dict[str, Any]:
    if request_limit < 1:
        raise ValueError("request_limit must be at least 1.")

    oid = ObjectId(client_id)
    client = await db["clients"].find_one({"_id": oid})
    if not client or not client.get("api_key"):
        raise ValueError("Client has no API profile yet.")

    now = datetime.now(timezone.utc)
    await db["clients"].update_one(
        {"_id": oid},
        {"$set": {"request_limit": request_limit, "updated_at": now}},
    )

    await sync_redis_client_profile(db, client_id)
    return await build_client_api_profile(db, client_id)


async def update_client_api_profile_status(
    db,
    client_id: str,
    status: str,
) -> Dict[str, Any]:
    """Set Redis profile status to ``active`` or ``inactive`` (lowercase)."""
    normalized = normalize_redis_profile_status(status, default="")
    if normalized not in (REDIS_STATUS_ACTIVE, REDIS_STATUS_INACTIVE):
        raise ValueError("status must be 'active' or 'inactive'.")

    oid = ObjectId(client_id)
    client = await db["clients"].find_one({"_id": oid})
    if not client or not client.get("api_key"):
        raise ValueError("Client has no API profile yet.")

    now = datetime.now(timezone.utc)
    await db["clients"].update_one(
        {"_id": oid},
        {"$set": {"api_profile_status": normalized, "updated_at": now}},
    )

    redis_client = await _get_redis()
    if redis_client:
        try:
            await redis_client.hset(_redis_key(client["api_key"]), "status", normalized)
        except Exception as exc:
            logger.warning("Failed to update Redis profile status for %s: %s", client_id, exc)
            await sync_redis_client_profile(db, client_id)

    return await build_client_api_profile(db, client_id)


async def sync_redis_client_profile(db, client_id) -> bool:
    """Rebuild Redis hash from MongoDB; preserve used and lifetimeUsed."""
    if isinstance(client_id, str):
        client_id = ObjectId(client_id)

    client = await db["clients"].find_one({"_id": client_id})
    if not client or not client.get("api_key"):
        return False

    api_list = await build_redis_api_list_string(db, client_id)

    return await _write_redis_profile(
        db,
        client_id=client_id,
        api_key=client["api_key"],
        is_new=False,
        assigned_by=client.get("api_profile_assigned_by", "admin"),
        api_list=api_list,
    )


async def sync_redis_api_list(db, client_id) -> bool:
    """Update only api_list in Redis (after assign/remove API)."""
    return await sync_redis_client_profile(db, client_id)


async def delete_redis_client_profile(api_key: str) -> bool:
    redis_client = await _get_redis()
    if not redis_client or not api_key:
        return False
    try:
        await redis_client.delete(_redis_key(api_key))
        return True
    except Exception as exc:
        logger.warning("Failed to delete Redis profile for key %s: %s", api_key[:8], exc)
        return False


async def _write_redis_profile(
    db,
    client_id,
    api_key: str,
    is_new: bool,
    assigned_by: str,
    api_list: str,
) -> bool:
    redis_client = await _get_redis()
    if not redis_client:
        return False

    client = await db["clients"].find_one({"_id": client_id})
    if not client:
        return False

    key = _redis_key(api_key)
    preserved = {} if is_new else await _read_preserved_fields(redis_client, key)

    redis_status_hint: Dict[str, str] = {}
    if not is_new:
        try:
            existing_status = await redis_client.hget(key, "status")
            if existing_status is not None:
                redis_status_hint["status"] = str(existing_status)
        except Exception:
            pass

    status = resolve_profile_status(client, redis_status_hint)

    if not client.get("api_profile_status"):
        await db["clients"].update_one(
            {"_id": client_id},
            {"$set": {"api_profile_status": status}},
        )

    client_id_str = str(client_id)
    default_used = "0" if is_new else str(client.get("current_usage", 0))
    default_lifetime = "0" if is_new else "0"

    payload = {
        "client_id": client_id_str,
        "api_key": api_key,
        "username": client.get("username", ""),
        "status": status,
        "used": preserved.get("used", default_used),
        "limit_frequency": LIMIT_FREQUENCY,
        "lifetimeUsed": preserved.get("lifetimeUsed", default_lifetime),
        "assigned_by": assigned_by or "admin",
        "request_limit": str(client.get("request_limit", 0)),
        "api_list": api_list,
    }

    try:
        await redis_client.hset(key, mapping=payload)
        return True
    except Exception as exc:
        logger.warning("Redis profile sync failed for client %s: %s", client_id, exc)
        return False


async def get_client_api_key(db, client_id) -> Optional[str]:
    """Return universal api_key from clients document, or legacy api_access."""
    if isinstance(client_id, str):
        client_id = ObjectId(client_id)

    client = await db["clients"].find_one({"_id": client_id})
    if client and client.get("api_key"):
        return client["api_key"]

    row = await db["api_access"].find_one({"client_id": client_id})
    return (row or {}).get("api_key")
