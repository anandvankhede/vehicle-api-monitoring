"""
Client Service — Business Logic for Client Management
======================================================

Handles all operations related to client companies and their associated
data: users, API access requests, API subscriptions, usage stats,
billing, activity records, and audit logs.

This is the largest service — it backs most of the admin dashboard.
"""

from bson import ObjectId
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from app.utils.security import hash_password, verify_password
from app.utils.helpers import generate_api_key, format_id
from app.services.user_mapping_service import sync_user_mapping


def _oid(id_str: str) -> ObjectId:
    """Helper: convert string ID to ObjectId (raises ValueError on bad format)."""
    return ObjectId(id_str)


async def _get_or_create_client_key(db, client_id) -> str:
    """
    Return the client's existing access key, or generate a NEW one if the
    client does not yet have any key (one access key per client).
    """
    existing = await db["api_access"].find_one({"client_id": client_id})
    if existing and existing.get("api_key"):
        return existing["api_key"]
    return generate_api_key()


def _clean(doc):
    """Remove password_hash and rename _id to id in a doc."""
    if doc is None:
        return None
    doc = dict(doc)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc


def _serialize(doc):
    """Serialize a MongoDB document: ObjectId → str, _id → id."""
    if isinstance(doc, list):
        return [_serialize(d) for d in doc]
    if doc is None:
        return None
    result = {}
    for k, v in doc.items():
        if k == "_id":
            result["id"] = str(v)
        elif isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, dict):
            result[k] = _serialize(v)
        elif isinstance(v, list):
            result[k] = [_serialize(i) if isinstance(i, dict) else i for i in v]
        elif isinstance(v, datetime):
            result[k] = v.isoformat()
        else:
            result[k] = v
    return result


class ClientService:
    """All business logic for the Client domain."""

    # ==================================================================
    # CLIENT CRUD
    # ==================================================================

    async def get_all_clients(self, db, skip: int = 0, limit: int = 100):
        """Return a paginated list of all clients."""
        cursor = db["clients"].find().skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        total = await db["clients"].count_documents({})
        return {"data": [_serialize(d) for d in docs], "total": total}

    async def get_client_by_id(self, db, client_id: str):
        """Return a single client by ID."""
        doc = await db["clients"].find_one({"_id": _oid(client_id)})
        return _serialize(doc)

    async def create_client(self, db, data: dict):
        """
        Create a new client company.

        Creates both a clients document and a linked client_users document
        (with the password hashed). Also logs an audit entry.
        """
        # Prevent duplicate usernames
        existing = await db["clients"].find_one({"username": data["username"].lower()})
        if existing:
            raise ValueError("Username already exists.")

        now = datetime.now(timezone.utc)
        password_hash = hash_password(data["password"])

        # Insert client document
        client_doc = {
            "username": data["username"].lower().strip(),
            "company_name": data["company_name"],
            "address": data.get("address", ""),
            "gstin": data.get("gstin", ""),
            "pan": data.get("pan", ""),
            "email": data["email"],
            "phone": data.get("phone", ""),
            "selected_apis": data.get("selected_apis", []),
            "comments": data.get("comments", ""),
            "request_status": data.get("request_status", "Pending"),
            "status": data.get("status", "Active"),
            "created_at": now,
            "updated_at": now,
        }
        result = await db["clients"].insert_one(client_doc)
        client_id = result.inserted_id

        # Create the client_user (login account) with hashed password
        user_doc = {
            "client_id": client_id,
            "username": data["username"].lower().strip(),
            "password_hash": password_hash,
            "role": "CLIENT",
            "status": "Active",
            "created_at": now,
            "updated_at": now,
        }
        await db["client_users"].insert_one(user_doc)

        # Audit log
        await db["audit_logs"].insert_one({
            "admin_username": "admin",
            "action": "Client Created",
            "details": f"Created client '{data['company_name']}'.",
            "timestamp": now,
        })

        # Keep the derived user_mapping in sync (assigned APIs + access key)
        await sync_user_mapping(db, client_id)

        return _serialize(client_doc) | {"id": str(client_id)}

    async def update_client(self, db, client_id: str, data: dict):
        """Update an existing client. Only provided fields are updated."""
        update_data = {k: v for k, v in data.items() if v is not None}
        update_data.pop("id", None)
        update_data["updated_at"] = datetime.now(timezone.utc)

        if "password" in update_data:
            password_hash = hash_password(update_data.pop("password"))
            update_data["password_hash"] = password_hash
            await db["client_users"].update_many(
                {"client_id": _oid(client_id)},
                {"$set": {"password_hash": password_hash, "updated_at": datetime.now(timezone.utc)}},
            )

        await db["clients"].update_one(
            {"_id": _oid(client_id)}, {"$set": update_data}
        )
        doc = await db["clients"].find_one({"_id": _oid(client_id)})
        await sync_user_mapping(db, _oid(client_id))
        return _serialize(doc)

    async def delete_client(self, db, client_id: str):
        """Permanently delete a client from the database."""
        # Delete the client
        result = await db["clients"].delete_one({"_id": _oid(client_id)})
        
        if result.deleted_count == 0:
            raise ValueError("Client not found")
        
        # Also delete associated client users
        await db["client_users"].delete_many({"client_id": _oid(client_id)})
        
        # Also delete associated API access records
        await db["api_access"].delete_many({"client_id": _oid(client_id)})
        
        # Also delete associated API requests
        await db["api_requests"].delete_many({"client_id": _oid(client_id)})

        # Remove the derived user_mapping entry (client is being hard-deleted)
        await db["user_mapping"].delete_one({"client_id": _oid(client_id)})
        
        # Also delete associated activity records
        await db["activity_records"].delete_many({"client_id": _oid(client_id)})
        
        # Also delete associated audit records
        await db["client_audit"].delete_many({"client_id": _oid(client_id)})
        
        # Log audit
        await db["audit_logs"].insert_one({
            "admin_username": "admin",
            "action": "Client Deleted",
            "details": f"Client {client_id} and all associated data permanently deleted.",
            "timestamp": datetime.now(timezone.utc),
        })
        
        return {"success": True, "message": "Client deleted successfully."}

    async def update_client_status(self, db, client_id: str, status: str):
        """Update a client's status (Active/Inactive)."""
        await db["clients"].update_one(
            {"_id": _oid(client_id)},
            {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}}
        )
        # Sync derived mapping status
        from app.services.user_mapping_service import update_user_mapping_status
        await update_user_mapping_status(db, client_id, active=(status == "Active"))
        return await db["clients"].find_one({"_id": _oid(client_id)})

    # ==================================================================
    # CLIENT USERS
    # ==================================================================

    async def get_all_client_users(self, db, skip: int = 0, limit: int = 100):
        """Return all client users (admin view)."""
        cursor = db["client_users"].find().skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        total = await db["client_users"].count_documents({})
        return {"data": [_serialize(d) for d in docs], "total": total}

    async def get_client_user_by_id(self, db, user_id: str):
        """Return a single client user by ID."""
        doc = await db["client_users"].find_one({"_id": _oid(user_id)})
        return _serialize(doc)

    async def get_client_users_by_client(self, db, client_id: str):
        """Return all client users for a specific client company."""
        cursor = db["client_users"].find({"client_id": _oid(client_id)})
        docs = await cursor.to_list(length=None)
        return [_serialize(d) for d in docs]

    async def create_client_user(self, db, data: dict):
        """Create a new client user account under a client company."""
        password_hash = hash_password(data["password"])
        now = datetime.now(timezone.utc)
        doc = {
            "client_id": _oid(data["client_id"]),
            "username": data["username"],
            "password_hash": password_hash,
            "role": data.get("role", "CLIENT"),
            "status": data.get("status", "Active"),
            "created_at": now,
            "updated_at": now,
        }
        result = await db["client_users"].insert_one(doc)
        await sync_user_mapping(db, doc["client_id"])
        return _serialize(doc) | {"id": str(result.inserted_id)}

    async def update_client_user(self, db, user_id: str, data: dict):
        """Update a client user's username, role, or status."""
        update_data = {k: v for k, v in data.items() if v is not None and k != "id"}
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db["client_users"].update_one(
            {"_id": _oid(user_id)}, {"$set": update_data}
        )
        doc = await db["client_users"].find_one({"_id": _oid(user_id)})
        if doc and doc.get("client_id"):
            await sync_user_mapping(db, doc["client_id"])
        return _serialize(doc)

    async def delete_client_user(self, db, user_id: str):
        """Delete a client user."""
        await db["client_users"].delete_one({"_id": _oid(user_id)})
        return {"success": True, "message": "Client user deleted successfully."}

    async def reset_client_password(self, db, user_id: str, new_password: str):
        """Reset a client user's password (admin-initiated)."""
        password_hash = hash_password(new_password)
        await db["client_users"].update_one(
            {"_id": _oid(user_id)},
            {"$set": {"password_hash": password_hash, "updated_at": datetime.now(timezone.utc)}}
        )
        return {"success": True, "message": "Password reset successfully."}

    # ==================================================================
    # API ACCESS (client → api subscription)
    # ==================================================================

    async def get_api_access_by_client(self, db, client_id: str):
        """Return all API access records for a specific client."""
        cursor = db["api_access"].find({"client_id": _oid(client_id)})
        docs = await cursor.to_list(length=None)
        return [_serialize(d) for d in docs]

    async def get_all_api_access(self, db):
        """Return all API access records (admin view)."""
        cursor = db["api_access"].find()
        docs = await cursor.to_list(length=None)
        return [_serialize(d) for d in docs]

    async def get_api_access_by_id(self, db, access_id: str):
        """Return a single API access record by ID."""
        doc = await db["api_access"].find_one({"_id": _oid(access_id)})
        return _serialize(doc)

    async def assign_api(self, db, data: dict):
        """
        Assign an API to a client.

        Creates an api_access document with a new API key and the
        specified pricing/limit configuration. Reconciles any pending
        api_request for the same client/API, or creates an approved
        api_request record when the admin assigns directly.
        """
        now = datetime.now(timezone.utc)
        client_id = _oid(data["client_id"])

        # ONE access key per client — reuse the existing key if the client
        # already has one, otherwise generate a new one.
        api_key = await _get_or_create_client_key(db, client_id)

        # Default prices if not provided
        success_price = data.get("success_price_per_hit", data.get("price_per_hit", 0.5))
        not_found_price = data.get("not_found_price_per_hit", success_price)

        doc = {
            "client_id": client_id,
            "api_name": data["api_name"],
            "status": data.get("status", "Active"),
            "api_key": api_key,
            "price_per_hit": success_price,
            "success_price_per_hit": success_price,
            "not_found_price_per_hit": not_found_price,
            "currency": data.get("currency", "INR"),
            "request_limit": data.get("request_limit", 10000),
            "limit_frequency": data.get("limit_frequency", "Per Day"),
            "current_usage": 0,
            "expiry_date": data.get("expiry_date"),
            "assigned_at": now,
            "assigned_by": data.get("assigned_by", "admin"),
            "updated_at": now,
        }
        result = await db["api_access"].insert_one(doc)

        api_name = data["api_name"]
        assigned_by = data.get("assigned_by", "admin")

        # Reconcile any existing pending client requests for this API
        pending_filter = {
            "client_id": client_id,
            "api_name": api_name,
            "status": "Pending Approval",
        }
        pending_result = await db["api_requests"].update_many(
            pending_filter,
            {"$set": {"status": "Approved", "reviewed_at": now}},
        )

        if pending_result.modified_count == 0:
            # No client request existed — admin assigned directly
            await db["api_requests"].insert_one({
                "client_id": client_id,
                "api_name": api_name,
                "status": "Approved",
                "requested_at": now,
                "reviewed_at": now,
            })
        else:
            # Client had a pending request — notify them it was approved
            await db["activity_records"].insert_one({
                "client_id": client_id,
                "type": "API Request",
                "title": api_name,
                "status": "Approved",
                "message": f"Your request for {api_name} has been approved.",
                "date": now,
                "api_name": api_name,
            })

            await db["client_audit"].insert_one({
                "client_id": client_id,
                "action": "API Approved",
                "details": f"API '{api_name}' access approved and assigned.",
                "admin_username": assigned_by,
                "timestamp": now,
            })

        # Audit log
        await db["audit_logs"].insert_one({
            "admin_username": assigned_by,
            "action": "API Assigned",
            "details": f"API '{api_name}' assigned to client {data['client_id']}.",
            "timestamp": now,
        })

        # Keep the derived user_mapping in sync (assigned APIs + access key)
        await sync_user_mapping(db, client_id)

        return _serialize(doc) | {"id": str(result.inserted_id)}

    async def update_api_access(self, db, access_id: str, data: dict):
        """Update an API access record (pricing, limits, status, etc.)."""
        update_data = {k: v for k, v in data.items() if v is not None and k != "id"}
        update_data["updated_at"] = datetime.now(timezone.utc)

        # Ensure price_per_hit stays in sync with success_price_per_hit
        if "success_price_per_hit" in update_data:
            update_data["price_per_hit"] = update_data["success_price_per_hit"]

        await db["api_access"].update_one(
            {"_id": _oid(access_id)}, {"$set": update_data}
        )
        doc = await db["api_access"].find_one({"_id": _oid(access_id)})
        await sync_user_mapping(db, doc["client_id"]) if doc and doc.get("client_id") else None
        return _serialize(doc)

    async def regenerate_api_key(self, db, access_id: str):
        """
        Regenerate the access key for a client.

        One access key per client: the new key is applied to ALL of the
        client's api_access records and to user_mapping. The old key is
        immediately invalidated.
        """
        existing = await db["api_access"].find_one({"_id": _oid(access_id)})
        if not existing:
            raise ValueError("API access record not found.")
        client_id = existing["client_id"]
        new_key = generate_api_key()
        now = datetime.now(timezone.utc)

        # Update every api_access record belonging to this client
        await db["api_access"].update_many(
            {"client_id": client_id},
            {"$set": {"api_key": new_key, "updated_at": now}}
        )

        # Sync the derived mapping's access key
        from app.services.user_mapping_service import update_user_mapping_access_key
        await update_user_mapping_access_key(db, str(client_id), new_key)

        await db["audit_logs"].insert_one({
            "admin_username": "admin",
            "action": "API Key Regenerated",
            "details": f"Access key regenerated for client {client_id}.",
            "timestamp": now,
        })
        return new_key

    async def delete_api_access(self, db, access_id: str):
        """Delete an API access record."""
        existing = await db["api_access"].find_one({"_id": _oid(access_id)})
        await db["api_access"].delete_one({"_id": _oid(access_id)})
        # Keep user_mapping in sync (removed API)
        if existing and existing.get("client_id"):
            await sync_user_mapping(db, existing["client_id"])
        return {"success": True, "message": "API access removed."}

    # ==================================================================
    # API REQUESTS (access requests)
    # ==================================================================

    async def _reconcile_pending_requests_with_access(self, db):
        """Mark pending api_requests as Approved when matching api_access already exists."""
        now = datetime.now(timezone.utc)
        pending_requests = await db["api_requests"].find(
            {"status": "Pending Approval"}
        ).to_list(length=None)

        for req in pending_requests:
            access = await db["api_access"].find_one({
                "client_id": req["client_id"],
                "api_name": req["api_name"],
            })
            if access:
                await db["api_requests"].update_one(
                    {"_id": req["_id"]},
                    {"$set": {"status": "Approved", "reviewed_at": now}},
                )

    async def get_all_api_requests(self, db, skip: int = 0, limit: int = 100,
                                    status_filter: str = "all"):
        """Return all API access requests, optionally filtered by status."""
        await self._reconcile_pending_requests_with_access(db)

        query = {}
        if status_filter != "all":
            query["status"] = status_filter

        cursor = db["api_requests"].find(query).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        total = await db["api_requests"].count_documents(query)
        return {"data": [_serialize(d) for d in docs], "total": total}

    async def get_api_requests_by_client(self, db, client_id: str):
        """Return all API requests for a specific client."""
        cursor = db["api_requests"].find({"client_id": _oid(client_id)})
        docs = await cursor.to_list(length=None)
        return [_serialize(d) for d in docs]

    async def get_api_request_by_id(self, db, request_id: str):
        """Return a single API request by ID."""
        doc = await db["api_requests"].find_one({"_id": _oid(request_id)})
        return _serialize(doc)

    async def create_api_request(self, db, data: dict):
        """Create a new API access request (client asks for an API)."""
        from app.services.api_collections import is_registered_api_name

        api_name = (data.get("api_name") or "").strip().lower()
        if not await is_registered_api_name(db, api_name):
            raise ValueError(
                f"API '{api_name}' is not available. Choose an API from the catalog."
            )

        now = datetime.now(timezone.utc)
        doc = {
            "client_id": _oid(data["client_id"]),
            "api_name": api_name,
            "status": "Pending Approval",
            "requested_at": now,
            "reviewed_at": None,
            "reason": None,
        }
        result = await db["api_requests"].insert_one(doc)

        # Activity record
        await db["activity_records"].insert_one({
            "client_id": _oid(data["client_id"]),
            "type": "API Request",
            "title": api_name,
            "status": "Pending Approval",
            "message": f"You requested access to {api_name}.",
            "date": now,
            "api_name": api_name,
        })
        return _serialize(doc) | {"id": str(result.inserted_id)}

    async def approve_api_request(self, db, request_id: str, config: dict):
        """
        Approve an API request: update its status and create an api_access record.
        """
        now = datetime.now(timezone.utc)
        req = await db["api_requests"].find_one({"_id": _oid(request_id)})
        if not req:
            raise ValueError("API request not found.")

        # Update request status to Approved
        await db["api_requests"].update_one(
            {"_id": _oid(request_id)},
            {"$set": {"status": "Approved", "reviewed_at": now}}
        )

        # Create the api_access record (reuse the client's single access key)
        client_id = req["client_id"]
        api_key = await _get_or_create_client_key(db, client_id)
        access_doc = {
            "client_id": client_id,
            "api_name": req["api_name"],
            "status": config.get("status", "Active"),
            "api_key": api_key,
            "price_per_hit": config.get("success_price_per_hit", config.get("price_per_hit", 0.5)),
            "success_price_per_hit": config.get("success_price_per_hit", 0.5),
            "not_found_price_per_hit": config.get("not_found_price_per_hit", 0.5),
            "currency": config.get("currency", "INR"),
            "request_limit": config.get("request_limit", 10000),
            "limit_frequency": config.get("limit_frequency", "Per Day"),
            "current_usage": 0,
            "expiry_date": config.get("expiry_date"),
            "assigned_at": now,
            "assigned_by": "admin",
            "updated_at": now,
        }
        await db["api_access"].insert_one(access_doc)

        # Audit: client-level
        await db["client_audit"].insert_one({
            "client_id": req["client_id"],
            "action": "API Approved",
            "details": f"API '{req['api_name']}' access approved and assigned.",
            "admin_username": "admin",
            "timestamp": now,
        })

        # Audit: system-level
        await db["audit_logs"].insert_one({
            "admin_username": "admin",
            "action": "API Request Approved",
            "details": f"Approved access to '{req['api_name']}' for client {req['client_id']}.",
            "timestamp": now,
        })

        # Activity record
        await db["activity_records"].insert_one({
            "client_id": req["client_id"],
            "type": "API Request",
            "title": req["api_name"],
            "status": "Approved",
            "message": f"Your request for {req['api_name']} has been approved.",
            "date": now,
            "api_name": req["api_name"],
        })

        # Keep the derived user_mapping in sync (assigned APIs + access key)
        await sync_user_mapping(db, client_id)

        return {"success": True, "message": "API request approved and access assigned."}

    async def reject_api_request(self, db, request_id: str, reason: str):
        """
        Reject an API request: update its status and reason, and
        log the rejection in the client's activity feed.
        """
        now = datetime.now(timezone.utc)
        req = await db["api_requests"].find_one({"_id": _oid(request_id)})
        if not req:
            raise ValueError("API request not found.")

        await db["api_requests"].update_one(
            {"_id": _oid(request_id)},
            {"$set": {"status": "Rejected", "reviewed_at": now, "reason": reason}}
        )

        # Activity record
        await db["activity_records"].insert_one({
            "client_id": req["client_id"],
            "type": "API Request",
            "title": req["api_name"],
            "status": "Changes Required",
            "message": f"Your request for {req['api_name']} was rejected: {reason}",
            "date": now,
            "api_name": req["api_name"],
            "reason": reason,
        })

        return {"success": True, "message": "API request rejected."}

    # ==================================================================
    # USAGE & BILLING
    # ==================================================================

    async def get_client_usage(self, db, client_id: str):
        """
        Calculate per-API usage summary for a client.

        Combines api_access records and usage_reports to produce
        usage percentages and remaining-request counts.
        """
        access_records = await self.get_api_access_by_client(db, client_id)
        usage_list = []

        for access in access_records:
            limit = access.get("request_limit", 0)
            current = access.get("current_usage", 0)
            usage_percent = int((current / limit * 100)) if limit > 0 else 0
            remaining = max(0, limit - current)
            price = access.get("success_price_per_hit", access.get("price_per_hit", 0))
            currency = access.get("currency", "INR")
            total_cost = round(current * price, 2)

            usage_list.append({
                "api_name": access["api_name"],
                "total_hits": current,
                "remaining_requests": remaining,
                "current_usage": current,
                "request_limit": limit,
                "usage_percent": usage_percent,
                "total_cost": total_cost,
                "currency": currency,
                "price_per_hit": price,
            })
        return usage_list

    async def get_billing_summary(self, db, client_id: str):
        """Return a billing summary for a client (estimated monthly cost)."""
        access_records = await self.get_api_access_by_client(db, client_id)
        items = []
        total = 0.0
        currency = "INR"
        for access in access_records:
            price = access.get("success_price_per_hit", access.get("price_per_hit", 0))
            current = access.get("current_usage", 0)
            cost = round(current * price, 2)
            total += cost
            currency = access.get("currency", currency)
            items.append({
                "api_name": access["api_name"],
                "total_hits": current,
                "price_per_hit": price,
                "total_cost": cost,
                "currency": access.get("currency", currency),
            })
        return {"monthly_cost": round(total, 2), "currency": currency, "items": items}

    # ==================================================================
    # ACTIVITY & AUDIT
    # ==================================================================

    async def get_client_activity(self, db, client_id: str):
        """Return all activity records for a specific client."""
        cursor = db["activity_records"].find({"client_id": _oid(client_id)})
        docs = await cursor.to_list(length=None)
        return [_serialize(d) for d in docs]

    async def get_recent_activity(self, db, limit: int = 10):
        """Return the most recent activity records (system-wide)."""
        cursor = db["activity_records"].find().sort("date", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [_serialize(d) for d in docs]

    async def get_registration_requests(self, db):
        """Return all registration requests."""
        cursor = db["registration_requests"].find()
        docs = await cursor.to_list(length=None)
        return [_serialize(d) for d in docs]

    async def get_audit_history(self, db, client_id: str):
        """Return client-specific audit entries."""
        cursor = db["client_audit"].find({"client_id": _oid(client_id)})
        docs = await cursor.to_list(length=None)
        return [_serialize(d) for d in docs]

    async def get_audit_logs(self, db, limit: int = 50):
        """Return system-wide admin audit logs."""
        cursor = db["audit_logs"].find().sort("timestamp", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [_serialize(d) for d in docs]

    # ==================================================================
    # AVAILABLE APIs
    # ==================================================================

    async def get_all_apis(self, db):
        """Return all available APIs from the catalog."""
        cursor = db["apis"].find()
        docs = await cursor.to_list(length=None)
        return [_serialize(d) for d in docs]

    async def get_api_by_name(self, db, name: str):
        """Return a single API from the catalog by name."""
        doc = await db["apis"].find_one({"name": name})
        return _serialize(doc)
