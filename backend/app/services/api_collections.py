"""
API → Response Collection Mapping
=================================

Central, single source of truth for mapping an application `api_name` to the
raw API-response collection on the `pan` database.

The frontend must send `api_name` (the application name) — NEVER a raw MongoDB
collection name. Backend validates against this map and refuses anything else.

Verified against live data in the `pan` database (all seven collections exist):
    chassis_to_rc      -> result_chassis_to_rc
    chassis_to_rc_data -> result_chassis_to_rc_data
    fastag_01          -> result_fastag_01
    fastag_02          -> result_fastag_02
    rc_data            -> result_rc_data
    rc_to_challan      -> result_rc_to_challan
    rc_to_mobile       -> result_rc_to_mobile
"""

from typing import Optional

API_COLLECTION_MAP = {
    "chassis_to_rc": "result_chassis_to_rc",
    "chassis_to_rc_data": "result_chassis_to_rc_data",
    "fastag_01": "result_fastag_01",
    "fastag_02": "result_fastag_02",
    "rc_data": "result_rc_data",
    "rc_to_challan": "result_rc_to_challan",
    "rc_to_mobile": "result_rc_to_mobile",
}

# Reverse lookup: collection -> api_name
COLLECTION_API_MAP = {v: k for k, v in API_COLLECTION_MAP.items()}


def get_response_collection_for_api(api_name: str) -> Optional[str]:
    """
    Return the `pan` response collection name for an application `api_name`.

    Returns None if the api_name is not a known application API name (prevents
    arbitrary collection names from being passed by the client).
    """
    if not api_name or api_name == "all":
        return None
    return API_COLLECTION_MAP.get(api_name)


def is_valid_api_name(api_name: str) -> bool:
    """True if api_name is a known application API name."""
    return api_name in API_COLLECTION_MAP
    