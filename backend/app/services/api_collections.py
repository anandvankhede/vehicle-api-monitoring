"""
Dynamic API ↔ Response Collection Mapping
=========================================

PAN response collections are discovered at runtime from the response database.
Each API response store follows the naming convention:

    MongoDB collection: result_{api_name}
    Application api_name: strip the ``result_`` prefix

When a new ``result_*`` collection is added to the PAN database it is picked
up automatically for dashboard KPIs, graphs, and client scoping — no code
changes or server restart required.

Optional manual overrides (non-standard collection names) can be added to
``API_COLLECTION_OVERRIDES`` without touching the rest of the app.
"""

from typing import Dict, List, Optional, Set

RESULT_COLLECTION_PREFIX = "result_"

# api_name -> collection_name (only for non-standard PAN collection names)
API_COLLECTION_OVERRIDES: Dict[str, str] = {}


def is_response_collection(collection_name: str) -> bool:
    """True when the collection name looks like a PAN API response store."""
    return bool(collection_name) and collection_name.startswith(RESULT_COLLECTION_PREFIX)


def api_name_from_collection(collection_name: str) -> Optional[str]:
    """Derive application api_name from a PAN collection name."""
    if collection_name in _override_collection_to_api():
        return _override_collection_to_api()[collection_name]
    if not is_response_collection(collection_name):
        return None
    api_name = collection_name[len(RESULT_COLLECTION_PREFIX):]
    return api_name or None


def collection_for_api_name(api_name: str) -> Optional[str]:
    """Map application api_name to its PAN collection name."""
    if not api_name or api_name == "all":
        return None
    if api_name in API_COLLECTION_OVERRIDES:
        return API_COLLECTION_OVERRIDES[api_name]
    return f"{RESULT_COLLECTION_PREFIX}{api_name}"


def get_response_collection_for_api(api_name: str) -> Optional[str]:
    """Return the PAN collection for an application api_name."""
    return collection_for_api_name(api_name)


def _override_collection_to_api() -> Dict[str, str]:
    return {coll: name for name, coll in API_COLLECTION_OVERRIDES.items()}


async def get_live_response_collections(response_db) -> List[str]:
    """Return PAN collection names that currently exist."""
    if response_db is None:
        return []
    try:
        names = await response_db.list_collection_names()
    except Exception:
        return []
    live = {name for name in names if is_response_collection(name)}
    live.update(API_COLLECTION_OVERRIDES.values())
    return sorted(live)


async def get_live_pan_api_names(response_db) -> List[str]:
    """
    Return application api_names for all PAN collections that currently exist.

    Reads collection names on every call so additions/removals are reflected
    immediately without redeploying.
    """
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
    """Return {api_name: collection_name} for all live PAN APIs."""
    result: Dict[str, str] = {}
    for coll in await get_live_response_collections(response_db):
        name = api_name_from_collection(coll)
        if name:
            result[name] = coll
    for api_name, coll in API_COLLECTION_OVERRIDES.items():
        if coll in set(await get_live_response_collections(response_db)):
            result[api_name] = coll
    return result


async def is_valid_api_name(api_name: str, response_db=None) -> bool:
    """True when api_name maps to a PAN collection that currently exists."""
    if not api_name or api_name == "all":
        return False
    if response_db is None:
        return collection_for_api_name(api_name) is not None
    live = set(await get_live_pan_api_names(response_db))
    return api_name in live
