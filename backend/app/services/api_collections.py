"""
API → Response Collection Mapping
=================================

Single source of truth for mapping application `api_name` to the raw
response collection on the external response database.

When a new API is added on the response DB side (e.g. 7 → 9 collections):

    1. Add one line here:  "new_api_name": "result_new_api_name"
    2. Register the API in the app catalog (`apis` collection) via Admin UI
       or seed script — same `name` as the key above.
    3. Ensure the collection already exists on the remote response database
       (this app never creates response collections).
    4. Restart the backend — startup verifies the response DB is reachable and
       at least one mapped collection exists (missing entries are skipped).

The frontend must send `api_name` (application name), never a raw MongoDB
collection name. Backend validates against this map and refuses anything else.
"""

from typing import List, Optional

API_COLLECTION_MAP = {
    "chassis_to_rc": "result_chassis_to_rc",
    "chassis_to_rc_data": "result_chassis_to_rc_data",
    "fastag_01": "result_fastag_01",
    "fastag_02": "result_fastag_02",
    "rc_data": "result_rc_data",
    "rc_to_challan": "result_rc_to_challan",
    "rc_to_mobile": "result_rc_to_mobile",
    # Add new APIs below, e.g.:
    # "new_api": "result_new_api",
}

# Reverse lookup: response collection name -> api_name
COLLECTION_API_MAP = {v: k for k, v in API_COLLECTION_MAP.items()}

# All response collections this app reads (derived from the map — do not duplicate elsewhere)
RESPONSE_COLLECTIONS: List[str] = sorted(set(API_COLLECTION_MAP.values()))


def get_response_collection_for_api(api_name: str) -> Optional[str]:
    """
    Return the response collection name for an application `api_name`.

    Returns None if the api_name is not a known application API name (prevents
    arbitrary collection names from being passed by the client).
    """
    if not api_name or api_name == "all":
        return None
    return API_COLLECTION_MAP.get(api_name)


def is_valid_api_name(api_name: str) -> bool:
    """True if api_name is a known application API name."""
    return api_name in API_COLLECTION_MAP


def get_all_api_names() -> List[str]:
    """All registered application API names (sorted)."""
    return sorted(API_COLLECTION_MAP.keys())


async def get_live_pan_api_names(response_db) -> List[str]:
    """
    Return API names whose mapped PAN collection currently exists.

    Reads collection names from the response database on each call so the
    dashboard reflects additions/removals without redeploying.
    """
    if response_db is None:
        return get_all_api_names()
    try:
        existing = set(await response_db.list_collection_names())
    except Exception:
        return get_all_api_names()
    return sorted(
        name for name, coll in API_COLLECTION_MAP.items()
        if coll in existing
    )
