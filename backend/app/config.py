"""
Application Configuration
========================

Reads all settings from environment variables using Pydantic Settings.
This is the single source of truth for all configurable values.

Copy .env.example → .env and fill in your values before running the server.
"""

from pydantic_settings import BaseSettings
from pydantic import Field, AliasChoices
from typing import List, Optional


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
    # In development, this is the Vite dev server.
    # In production, this would be your deployed frontend domain.
    FRONTEND_ORIGINS: List[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"],
        env="FRONTEND_ORIGINS",
        description="Comma-separated list of allowed frontend origins for CORS"
    )

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
