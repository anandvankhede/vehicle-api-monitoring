"""
Application Configuration
========================

Reads all settings from environment variables using Pydantic Settings.
This is the single source of truth for all configurable values.

Copy .env.example → .env and fill in your values before running the server.
"""

import json
from typing import List, Optional, Union

from pydantic import Field, AliasChoices, field_validator, model_validator
from pydantic_settings import BaseSettings


def _parse_origin_list(value: Union[str, List[str], None]) -> List[str]:
    """
    Parse CORS origins from env values.

    Supported formats:
        - JSON array:  ["http://localhost:3000","http://1.2.3.4:3000"]
        - CSV string:  http://localhost:3000,http://1.2.3.4:3000
    """
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip().rstrip("/") for item in value if str(item).strip()]

    raw = str(value).strip()
    if not raw:
        return []

    if raw.startswith("["):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(item).strip().rstrip("/") for item in parsed if str(item).strip()]
        except json.JSONDecodeError:
            pass

    return [part.strip().rstrip("/") for part in raw.split(",") if part.strip()]


class Settings(BaseSettings):
    """
    All application settings. Each field maps to an environment variable.
    Defaults are provided for local development.
    """

    # --- MongoDB ---
    MONGO_URL: str = Field(
        default="mongodb://localhost:27017",
        env="MONGO_URL",
        description="MongoDB connection string (e.g., mongodb://localhost:27017)"
    )
    DATABASE_NAME: str = Field(
        default="vehical_api_monitoring",
        env="DATABASE_NAME",
        description="MongoDB database name"
    )
    RESPONSE_DATABASE_NAME: str = Field(
        default="pan",
        validation_alias=AliasChoices("RESPONSE_DATABASE_NAME", "PAN_DATABASE_NAME"),
        description="MongoDB database name holding raw API responses (name may differ per environment)",
    )
    RESPONSE_MONGO_URL: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices(
            "RESPONSE_MONGO_URL",
            "RESPONSE_MONGO_URI",
            "PAN_MONGO_URL",
            "PAN_MONGO_URI",
        ),
        description=(
            "Dedicated MongoDB URI for the response database. "
            "When missing or unreachable, the app still starts; response analytics stay empty."
        ),
    )
    # --- response_db read load limits (protect shared Mongo with live API) ---
    RESPONSE_DB_QUERY_MAX_MS: int = Field(
        default=15_000,
        env="RESPONSE_DB_QUERY_MAX_MS",
        description="Max milliseconds per response_db read query; 0 disables the limit.",
    )
    RESPONSE_DB_MAX_POOL_SIZE: int = Field(
        default=5,
        env="RESPONSE_DB_MAX_POOL_SIZE",
        description="Max Mongo connections used only for response_db read analytics.",
    )
    RESPONSE_DB_MAX_CONCURRENT_QUERIES: int = Field(
        default=2,
        env="RESPONSE_DB_MAX_CONCURRENT_QUERIES",
        description="Max response_db queries running at once across all dashboard requests.",
    )
    RESPONSE_DB_COLLECTION_CACHE_SECONDS: int = Field(
        default=60,
        validation_alias=AliasChoices(
            "RESPONSE_DB_COLLECTION_CACHE_SECONDS",
            "PAN_COLLECTION_CACHE_SECONDS",
        ),
        description="Cache TTL for list_collection_names() on the response database.",
    )
    RESPONSE_DB_READ_PREFERENCE: Optional[str] = Field(
        default=None,
        env="RESPONSE_DB_READ_PREFERENCE",
        description=(
            "Optional Mongo read preference for response_db analytics only: "
            "primary, primaryPreferred, secondary, secondaryPreferred, nearest."
        ),
    )
    DASHBOARD_TIMEZONE: str = Field(
        default="Asia/Kolkata",
        env="DASHBOARD_TIMEZONE",
        description=(
            "IANA timezone for dashboard filters. Response DB created_time is stored "
            "as naive local timestamps in this zone."
        ),
    )

    # --- JWT / Security ---
    SECRET_KEY: str = Field(
        env="SECRET_KEY",
        description="Secret key for JWT signing — MUST be set in production"
    )
    # Warn if using default-like secret (development only check)
    _SECRET_KEY_WARNING: bool = False
    ALGORITHM: str = Field(default="HS256", env="ALGORITHM")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=1440,  # 1 day
        env="ACCESS_TOKEN_EXPIRE_MINUTES",
        description="JWT token expiration in minutes (default 1440 = 24 hours)"
    )

    # --- CORS ---
    # Frontend URLs allowed to access the backend.
    # Accepts JSON array or comma-separated list.
    # On a VM, set PUBLIC_FRONTEND_URL to the browser URL, e.g. http://20.1.2.3:3000
    FRONTEND_ORIGINS: List[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"],
        validation_alias=AliasChoices("FRONTEND_ORIGINS", "CORS_ORIGINS"),
        description="Allowed frontend origins for CORS (JSON array or comma-separated)",
    )
    PUBLIC_FRONTEND_URL: Optional[str] = Field(
        default=None,
        env="PUBLIC_FRONTEND_URL",
        description=(
            "Production frontend URL shown in the browser (scheme + host + port). "
            "Automatically added to FRONTEND_ORIGINS on startup."
        ),
    )

    @field_validator("FRONTEND_ORIGINS", mode="before")
    @classmethod
    def parse_frontend_origins(cls, value):
        return _parse_origin_list(value)

    @model_validator(mode="after")
    def merge_public_frontend_url(self):
        if self.PUBLIC_FRONTEND_URL:
            public_origin = self.PUBLIC_FRONTEND_URL.strip().rstrip("/")
            if public_origin and public_origin not in self.FRONTEND_ORIGINS:
                self.FRONTEND_ORIGINS.append(public_origin)
        return self

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
