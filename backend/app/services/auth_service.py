"""
Authentication Service
======================

Business logic for authentication:
    - Admin login (username + password → JWT token)
    - Client login (username + password → JWT token)
    - Token-based user lookup

This service does NOT handle registration — that's done in
client_service.register() (for client registration).
"""

from bson import ObjectId
from app.utils.security import hash_password, verify_password, create_access_token
from app.utils.helpers import utc_now_iso, generate_api_key
from datetime import timedelta
from app.config import settings


class AuthService:
    """
    Handles authentication for both admin and client users.

    All methods are async because they interact with MongoDB via Motor.
    Each method receives the Motor database instance as its first argument.
    """

    # ------------------------------------------------------------------
    # Admin login
    # ------------------------------------------------------------------

    async def admin_login(self, db, username: str, password: str):
        """
        Authenticate an admin user.

        Looks up the user by username in the "users" collection,
        verifies the password hash, and returns a JWT token + user info.

        Args:
            db:       Motor database instance.
            username: The admin's username.
            password: The admin's plain-text password.

        Returns:
            dict with: access_token, token_type, user (id, username, name, role, avatar)

        Raises:
            ValueError: If username not found, password incorrect, or account inactive.
        """
        # Step 1: Look up the admin user by username
        user = await db["users"].find_one({"username": username})

        if user is None:
            # Guide client users to the correct portal
            client_user = await db["client_users"].find_one({
                "username": {"$regex": f"^{username.lower().strip()}$", "$options": "i"}
            })
            if client_user and verify_password(password, client_user["password_hash"]):
                raise ValueError("Please sign in through the Client Portal.")
            raise ValueError("Invalid username or password")

        # Step 2: Check if the account is active
        if not user.get("is_active", True):
            raise ValueError("Account is deactivated")

        # Step 3: Verify the password against the stored hash
        if not verify_password(password, user["password_hash"]):
            raise ValueError("Invalid username or password")

        # Step 4: Create JWT token
        token_data = {
            "sub": str(user["_id"]),
            "username": user["username"],
            "role": user.get("role", "admin"),
            "name": f"{user.get('name', '')}",
            "type": "admin",
        }
        # Use a friendly name if the user document has one
        if not token_data["name"]:
            token_data["name"] = user["username"].capitalize()

        access_token = create_access_token(token_data)

        # Step 5: Return token + user identity
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user["_id"]),
                "username": user["username"],
                "name": token_data["name"],
                "role": user.get("role", "admin"),
                "avatar": user.get("avatar"),
            },
        }

    # ------------------------------------------------------------------
    # Client login
    # ------------------------------------------------------------------

    async def client_login(self, db, username: str, password: str):
        """
        Authenticate a client user.

        Looks up the client_user by username, verifies the password,
        then looks up the parent client (company) for the company_name.
        Supports legacy clients that only have credentials on the clients
        collection and auto-creates a client_users record when needed.
        """
        normalized_username = username.lower().strip()

        # Step 1: Find the client user by username (case-insensitive)
        user = await db["client_users"].find_one({
            "username": {"$regex": f"^{normalized_username}$", "$options": "i"}
        })

        client = None

        if user is None:
            # Fallback: legacy clients with credentials stored on clients collection
            client = await db["clients"].find_one({"username": normalized_username})
            if client is None or not client.get("password_hash"):
                # Guide admin users to the correct portal
                admin_user = await db["users"].find_one({"username": username})
                if admin_user and verify_password(password, admin_user["password_hash"]):
                    raise ValueError("Please sign in through the Admin Portal.")
                raise ValueError("Invalid username or password")

            if not verify_password(password, client["password_hash"]):
                raise ValueError("Invalid username or password")

            now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
            user_result = await db["client_users"].insert_one({
                "client_id": client["_id"],
                "username": normalized_username,
                "password_hash": client["password_hash"],
                "role": "CLIENT",
                "status": "Active",
                "created_at": now,
                "updated_at": now,
            })
            user = {
                "_id": user_result.inserted_id,
                "client_id": client["_id"],
                "username": normalized_username,
                "status": "Active",
            }
        else:
            # Step 2: Check account status
            if user.get("status") != "Active":
                raise ValueError("Your account has been deactivated.")

            # Step 3: Verify password
            if not verify_password(password, user["password_hash"]):
                raise ValueError("Invalid username or password")

            # Step 4: Look up the parent client (company)
            client = await db["clients"].find_one({"_id": user["client_id"]})

        if client is None:
            raise ValueError("Client company not found.")

        if client.get("status") != "Active":
            raise ValueError("Your company account has been deactivated.")

        company_name = client.get("company_name", "Unknown")

        # Step 5: Create JWT token with client type
        token_data = {
            "sub": str(user["_id"]),
            "username": user.get("username", normalized_username),
            "client_id": str(user["client_id"]),
            "company_name": company_name,
            "type": "client",
            "role": "client",
        }
        access_token = create_access_token(token_data)

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "client": {
                "id": str(user["_id"]),
                "client_id": str(user["client_id"]),
                "username": user.get("username", normalized_username),
                "company_name": company_name,
            },
        }

    # ------------------------------------------------------------------
    # Client registration
    # ------------------------------------------------------------------

    async def client_register(self, db, data: dict):
        """
        Register a new client company.

        Creates two records in a single logical transaction:
            1. A "clients" document (the company)
            2. A "client_users" document (the login user, with bcrypt-hashed password)
            3. An "activity_records" entry (audit trail)

        Note: Registration is instant - no approval required. Client can login immediately.

        Args:
            db:   Motor database instance.
            data: Dict with company_name, username, email, phone, address,
                  gstin, pan, password.

        Returns:
            dict with the newly created client's id and username.

        Raises:
            ValueError: If the username already exists.
        """
        from app.utils.helpers import format_id

        # Check for duplicate username (in either client_users or clients)
        existing = await db["client_users"].find_one({
            "username": {"$regex": f"^{data['username']}$", "$options": "i"}
        })
        if existing:
            raise ValueError("Username already exists.")

        # Generate IDs and timestamps
        now = utc_now_iso()
        now_dt = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)

        # Hash the password
        password_hash = hash_password(data["password"])

        # Step 1: Create the client (company) document
        client_doc = {
            "username": data["username"].lower().strip(),
            "company_name": data["company_name"].strip(),
            "address": data["address"].strip(),
            "gstin": data["gstin"].upper().strip(),
            "pan": data["pan"].upper().strip(),
            "email": data["email"].strip(),
            "phone": data["phone"].strip(),
            "selected_apis": [],
            "comments": "",
            "request_status": "Approved",
            "status": "Active",
            "created_at": now_dt,
            "updated_at": now_dt,
        }
        client_result = await db["clients"].insert_one(client_doc)
        client_id = client_result.inserted_id

        # Step 2: Create the client_user document (links to the client)
        user_doc = {
            "client_id": client_id,
            "username": data["username"].lower().strip(),
            "password_hash": password_hash,
            "role": "CLIENT",
            "status": "Active",
            "created_at": now_dt,
            "updated_at": now_dt,
        }
        await db["client_users"].insert_one(user_doc)

        from app.services.user_mapping_service import sync_user_mapping
        await sync_user_mapping(db, client_id)

        # Step 3: Log an activity record
        activity_doc = {
            "client_id": client_id,
            "type": "Company Registration",
            "title": "Company Registration",
            "status": "Approved",
            "message": "Your company registration has been approved. You can now log in.",
            "date": now_dt,
        }
        await db["activity_records"].insert_one(activity_doc)

        # Step 4: Add an admin audit log
        audit_doc = {
            "admin_username": "system",
            "action": "Client Registered",
            "details": f"New client company '{data['company_name'].strip()}' registered.",
            "timestamp": now_dt,
        }
        await db["audit_logs"].insert_one(audit_doc)

        return {
            "id": str(client_id),
            "username": data["username"].lower().strip(),
            "company_name": data["company_name"].strip(),
        }

    # ------------------------------------------------------------------
    # Client login by username (alternative lookup for the frontend)
    # ------------------------------------------------------------------

    async def get_client_by_username(self, db, username: str):
        """
        Look up a client (company) by the associated client_user's username.
        Used by the frontend's ClientAuthContext after login.
        """
        user = await db["client_users"].find_one({
            "username": {"$regex": f"^{username}$", "$options": "i"}
        })
        if not user:
            return None
        client = await db["clients"].find_one({"_id": user["client_id"]})
        if not client:
            return None
        return client
