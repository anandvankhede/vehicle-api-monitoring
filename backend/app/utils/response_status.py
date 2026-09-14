"""
API response status classification for dashboard graphs and usage reports.

Current live response schema (response DB ``response`` object):
    response_code 100 + non-empty result -> SUCCESS  (data found)
    response_code 103 + empty result      -> NOT_FOUND (record not found)
    response_code 110                     -> FAILED   (processing/upstream error)

Legacy codes: 101, 200 -> SUCCESS

Note: top-level ``success`` boolean is NOT used for classification.
"""

from typing import Any, Dict, Optional


SUCCESS_CODES = frozenset({100, 101, 200})
NOT_FOUND_CODES = frozenset({103})
FAILED_CODES = frozenset({110})


def _code_int(code: Any) -> Optional[int]:
    if code is None:
        return None
    try:
        return int(code)
    except (TypeError, ValueError):
        return None


def _code_str(code: Any) -> str:
    return str(code).strip() if code is not None else ""


def is_empty_result(result: Any) -> bool:
    if result is None:
        return True
    if isinstance(result, dict):
        return len(result) == 0
    if isinstance(result, list):
        return len(result) == 0
    if isinstance(result, str):
        return not result.strip()
    return False


def classify_response_code(code: Any) -> str:
    """
    Map ``response_code`` alone to SUCCESS | NOT_FOUND | FAILED | OTHER.

    Used in Mongo aggregations that group only by response_code.
    """
    n = _code_int(code)
    s = _code_str(code)
    if n in SUCCESS_CODES or s in ("100", "101", "200"):
        return "SUCCESS"
    if n in NOT_FOUND_CODES or s == "103":
        return "NOT_FOUND"
    if n in FAILED_CODES or s == "110":
        return "FAILED"
    return "OTHER"


def normalize_response_status(response: Any) -> str:
    """
    Classify a full ``response`` object using response_code (primary).

    Returns SUCCESS | NOT_FOUND | FAILED | OTHER.
    """
    if not isinstance(response, dict):
        return "OTHER"

    code = response.get("response_code")
    n = _code_int(code)
    s = _code_str(code)

    if n in SUCCESS_CODES or s in ("100", "101", "200"):
        return "SUCCESS"
    if n in NOT_FOUND_CODES or s == "103":
        return "NOT_FOUND"
    if n in FAILED_CODES or s == "110":
        return "FAILED"

    msg = str(response.get("response_msg") or "").strip().lower()
    if msg == "success":
        return "SUCCESS"
    if msg in ("not found", "not_found", "data not found", "no data"):
        return "NOT_FOUND"
    if msg in ("failure", "failed", "error"):
        return "FAILED"

    if not is_empty_result(response.get("result")):
        return "SUCCESS"

    rs = str(response.get("responseStatus", "")).strip().lower()
    if rs == "success":
        return "SUCCESS"
    if rs in ("not found", "not_found"):
        return "NOT_FOUND"
    if rs in ("error", "failed", "failure"):
        return "FAILED"

    return "OTHER"


def status_filter_match(status_filter: str) -> Dict[str, Any]:
    """Mongo match fragment for row-level response status filtering."""
    if status_filter == "success":
        return {"response.response_code": {"$in": [100, 101, 200, "100", "101", "200"]}}
    if status_filter == "failed":
        return {"response.response_code": {"$in": [110, "110"]}}
    if status_filter in ("notFound", "not_found"):
        return {"response.response_code": {"$in": [103, "103"]}}
    return {}
