"""
Registration Requests Router
============================

Endpoints:
    - GET    /registration-requests    — List all registration requests
    - POST   /registration-requests    — Create a registration request
    - GET    /registration-requests/{id} — Get a single registration request
    - PUT    /registration-requests/{id} — Update a registration request status
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timezone

from app.database import get_database
from app.dependencies.auth import get_current_admin, get_current_client
from app.schemas.common import BaseResponse, ErrorResponse
from app.services.client_service import ClientService

router = APIRouter(prefix="/registration-requests", tags=["Registration Requests"])

client_service = ClientService()


@router.get(
    "",
    responses={401: {"model": ErrorResponse}},
)
async def list_registration_requests(
    status_filter: str = Query("all", alias="status", description="all | Pending | Approved | Changes Required"),
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    List all registration requests with optional status filtering.
    """
    query = {}
    if status_filter != "all":
        query["status"] = status_filter

    cursor = db["registration_requests"].find(query).sort("submitted_date", -1)
    docs = await cursor.to_list(length=None)

    from app.services.client_service import _serialize
    return {"data": [_serialize(d) for d in docs], "total": len(docs)}


@router.post(
    "",
    response_model=BaseResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def create_registration_request(
    body: dict,
    db=Depends(get_database),
    _=Depends(get_current_client),
):
    """
    Create a new registration request.

    Body:
        - client_id:      The client company ID
        - company_name:   Company name
        - email:          Contact email
        - phone:          Contact phone
        - requested_apis: List of requested API names
    """
    client_id = body.get("client_id")
    company_name = body.get("company_name")
    email = body.get("email", "")
    phone = body.get("phone", "")
    requested_apis = body.get("requested_apis", [])

    if not client_id or not company_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="client_id and company_name are required",
        )

    from bson import ObjectId

    # Verify client exists
    client = await db["clients"].find_one({"_id": ObjectId(client_id)})
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )

    # Check for existing pending request
    existing = await db["registration_requests"].find_one({
        "client_id": ObjectId(client_id),
        "status": "Pending",
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A pending registration request already exists for this client",
        )

    now = datetime.now(timezone.utc)
    await db["registration_requests"].insert_one({
        "client_id": ObjectId(client_id),
        "company_name": company_name,
        "email": email,
        "phone": phone,
        "requested_apis": requested_apis,
        "submitted_date": now,
        "status": "Pending",
    })

    # Add activity record
    await db["activity_records"].insert_one({
        "client_id": ObjectId(client_id),
        "type": "Company Registration",
        "title": "Company Registration",
        "status": "Submitted",
        "message": "Registration request submitted for review.",
        "date": now,
    })

    return BaseResponse(success=True, message="Registration request created successfully.")


@router.get(
    "/{request_id}",
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def get_registration_request(
    request_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Get a single registration request by ID.
    """
    from bson import ObjectId
    try:
        doc = await db["registration_requests"].find_one({"_id": ObjectId(request_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration request not found",
        )
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration request not found",
        )
    from app.services.client_service import _serialize
    return _serialize(doc)


@router.put(
    "/{request_id}",
    response_model=BaseResponse,
    responses={404: {"model": ErrorResponse}, 400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def update_registration_request(
    request_id: str,
    body: dict,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Update a registration request's status.

    Body:
        - status: "Approved" | "Changes Required"
        - reason: Optional reason (required for "Changes Required")
    """
    from bson import ObjectId

    status_val = body.get("status")
    reason = body.get("reason")

    if status_val not in ("Approved", "Changes Required"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'Approved' or 'Changes Required'",
        )

    if status_val == "Changes Required" and not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reason is required when requesting changes",
        )

    try:
        request = await db["registration_requests"].find_one({"_id": ObjectId(request_id)})
        if not request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Registration request not found",
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registration request not found",
        )

    # Update the registration request
    update_data = {"status": status_val}
    if reason:
        update_data["reason"] = reason
    await db["registration_requests"].update_one(
        {"_id": request["_id"]},
        {"$set": update_data}
    )

    # Update the client's request_status
    client_id = request.get("client_id")
    if client_id:
        client_update = {"updated_at": datetime.now(timezone.utc)}
        if status_val == "Approved":
            client_update["request_status"] = "Approved"
        await db["clients"].update_one(
            {"_id": client_id},
            {"$set": client_update}
        )

        # Add activity record
        now = datetime.now(timezone.utc)
        activity_doc = {
            "client_id": client_id,
            "type": "Company Registration",
            "title": "Company Registration",
            "status": status_val,
            "message": (
                "Your company registration has been approved."
                if status_val == "Approved"
                else "Your company registration requires changes."
            ),
            "date": now,
            "reason": reason,
            "action": "Edit Company Details" if status_val == "Changes Required" else None,
        }
        await db["activity_records"].insert_one(activity_doc)

        # Add audit log
        await db["audit_logs"].insert_one({
            "admin_username": "admin",
            "action": "Registration " + status_val,
            "details": f"Registration request for {request.get('company_name', '')} {status_val.lower()}.",
            "timestamp": now,
        })

    return BaseResponse(success=True, message=f"Registration request {status_val}.")