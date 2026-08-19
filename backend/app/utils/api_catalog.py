"""
API catalog bootstrap
=====================

Ensures the application `apis` collection contains an entry for every
API name registered in API_COLLECTION_MAP. Idempotent — safe on every startup.
"""

from datetime import datetime, timezone

from app.services.api_collections import get_all_api_names


async def ensure_api_catalog(db) -> int:
    """
    Insert missing catalog entries for registered API names.

    Returns:
        Number of new API documents created.
    """
    now = datetime.now(timezone.utc)
    created = 0

    for api_name in get_all_api_names():
        existing = await db["apis"].find_one({"name": api_name})
        if existing:
            continue

        label = api_name.replace("_", " ").title()
        await db["apis"].insert_one({
            "name": api_name,
            "description": f"{label} API",
            "category": "vehicle",
            "endpoint": f"/{api_name}",
            "method": "GET",
            "headers": [],
            "request_schema": None,
            "response_schema": None,
            "is_active": True,
            "pricing_success": 0.5,
            "pricing_not_found": 0.5,
            "currency": "INR",
            "documentation": None,
            "created_by": "system",
            "created_at": now,
            "updated_at": now,
        })
        created += 1
        print(f"  [OK] API catalog entry created: {api_name}")

    return created
