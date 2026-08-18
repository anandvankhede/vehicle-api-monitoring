"""
user_mapping Service — Read-Optimized Derived Mapping
======================================================

`user_mapping` is a DERIVED collection that mirrors:
    clients + client_users + api_access

It is NOT the primary source of truth. It exists so the dashboard can resolve a
client (client_id / username / company) and their single access key + assigned
APIs in one indexed read.

Document:
    {
        client_id:    ObjectId,
        username:     str,
        company_name: str,
        access_key:   str,     # ONE access key per client (shared across APIs)
        apis:         [str],   # assigned application API names
        status:       "Active" | "Inactive",
        created_at, updated_at
    }

These functions keep user_mapping in sync whenever the source collections change.
"""

from datetime import datetime, timezone

from bson import ObjectId


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_client_access_key(db, client_id) -> str:
    """Return the client's access key from api_access, or '' if none."""
    row = await db["api_access"].find_one({"client_id": client_id})
    return (row or {}).get("api_key", "")


async def _collect_assigned_apis(db, client_id) -> list:
    """List of application api_names assigned to a client in api_access."""
    cursor = db["api_access"].find(
        {"client_id": client_id, "status": {"$in": ["Active", "Suspended"]}})
    names = []
    async for a in cursor:
        if a.get("api_name") and a["api_name"] not in names:
            names.append(a["api_name"])
    return names


async def sync_user_mapping(db, client_id) -> dict:
    """
    (Re)build the user_mapping document for a client from its source collections.

    Upserts one document per client. Safe to call after any relevant change.
    """
    if not isinstance(client_id, ObjectId):
        client_id = ObjectId(client_id)

    client = await db["clients"].find_one({"_id": client_id})
    client_user = await db["client_users"].find_one({"client_id": client_id})
    assigned = await _collect_assigned_apis(db, client_id)
    access_key = await _get_client_access_key(db, client_id)

    username = (client_user or {}).get("username", (client or {}).get("username", ""))
    company_name = (client or {}).get("company_name", "")
    status = (client or {}).get("status", "Active")
    if status == "Active":
        status = "Active"
    else:
        status = "Inactive"

    now = _now()
    result = await db["user_mapping"].update_one(
        {"client_id": client_id},
        {"$set": {
            "username": username,
            "company_name": company_name,
            "access_key": access_key,
            "apis": assigned,
            "status": status,
            "updated_at": now,
        }, "$setOnInsert": {"client_id": client_id, "created_at": now}},
        upsert=True,
    )
    return {"client_id": str(client_id), "username": username,
            "access_key": access_key, "apis": assigned, "status": status}


async def update_user_mapping_status(db, client_id, active: bool) -> None:
    """Set user_mapping.status from a client's active/inactive state."""
    await db["user_mapping"].update_one(
        {"client_id": ObjectId(client_id)},
        {"$set": {"status": "Active" if active else "Inactive",
                  "updated_at": _now()}},
    )


async def update_user_mapping_access_key(db, client_id, access_key: str) -> None:
    """Refresh the access key on a client's user_mapping (key regeneration)."""
    await db["user_mapping"].update_one(
        {"client_id": ObjectId(client_id)},
        {"$set": {"access_key": access_key, "updated_at": _now()}},
    )
