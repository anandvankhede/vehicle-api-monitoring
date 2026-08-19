"""
Database Seed Data
==================

Populates the MongoDB database with initial demonstration data:
    - Admin user (credentials: admin / admin123)

Run with:
    python -m app.utils.seed_data
"""

import asyncio
from datetime import datetime, timezone

from app.database import db_manager
from app.utils.api_catalog import ensure_api_catalog
from app.utils.security import hash_password


async def seed():
    """Seed the database with demo data."""
    print("[OK] Starting database seeding...")
    db_manager.connect()
    db = db_manager.get_db()

    # ========================================================================
    # 1. ADMIN USER
    # ========================================================================
    existing_admin = await db["users"].find_one({"username": "admin"})
    if not existing_admin:
        admin_id = __import__("bson").ObjectId()
        await db["users"].insert_one({
            "_id": admin_id,
            "username": "admin",
            "password_hash": hash_password("kyzify@2026"),
            "name": "Admin User",
            "email": "admin@vehicleapi.com",
            "role": "admin",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })
        print("  [OK] Admin user created (username: admin, password: admin123)")

    # ========================================================================
    # 2. API CATALOG (from API_COLLECTION_MAP)
    # ========================================================================
    seeded = await ensure_api_catalog(db)
    if seeded:
        print(f"  [OK] API catalog seeded ({seeded} APIs)")

    # ========================================================================
    # DONE
    # ========================================================================
    print("\n[OK] Database seeding complete!")
    print("\nDemo credentials:")
    print("  Admin:  admin / admin123")

    db_manager.close()


if __name__ == "__main__":
    asyncio.run(seed())