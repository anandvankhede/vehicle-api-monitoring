"""
Dashboard timezone helpers.

Raw API responses store `created_time` as naive local strings
(YYYY-MM-DD HH:mm:ss) in the configured dashboard timezone — not UTC.
All dashboard time filters must use the same zone when building query bounds
and chart buckets.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import settings

_CREATED_TIME_FMT = "%Y-%m-%d %H:%M:%S"


def dashboard_tz() -> ZoneInfo:
    return ZoneInfo(settings.DASHBOARD_TIMEZONE)


def now_dashboard() -> datetime:
    """Current time in the dashboard timezone."""
    return datetime.now(dashboard_tz())


def to_dashboard_naive(dt: datetime) -> datetime:
    """Convert an aware datetime to naive local dashboard time."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(dashboard_tz()).replace(tzinfo=None)


def fmt_created_time(dt: datetime) -> str:
    """Format a datetime as the pan.created_time string representation."""
    return to_dashboard_naive(dt).strftime(_CREATED_TIME_FMT)


def parse_created_bound(value: str) -> datetime:
    """Parse a date or datetime bound into naive dashboard-local time."""
    value = value.strip()
    try:
        return datetime.strptime(value, _CREATED_TIME_FMT)
    except ValueError:
        pass
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return to_dashboard_naive(now_dashboard())
