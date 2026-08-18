"""
Audit Logs Router
=================

Endpoints:
    - GET  /audit-logs — List all audit logs (system-wide)
    - POST /audit-logs — Create an audit log entry
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timezone

from app.database import get_database
from app.dependencies.auth import get_current_admin
from app.schemas.common import BaseResponse, ErrorResponse

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get(
    "",
    responses={401: {"model": ErrorResponse}},
)
async def list_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    List all audit logs (admin view).

    Query params:
        - skip:  Pagination offset
        - limit: Records per page
    """
    cursor = db["audit_logs"].find().sort("timestamp", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db["audit_logs"].count_documents({})

    from app.services.client_service import _serialize
    return {"data": [_serialize(d) for d in docs], "total": total}


@router.post(
    "",
    response_model=BaseResponse,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def create_audit_log(
    body: dict,
    db=Depends(get_database),
    user=Depends(get_current_admin),
):
    """
    Create a new audit log entry.

    Body:
        - admin_username: The admin who performed the action
        - action:         The action that was performed
        - details:        Additional details about the action
    """
    admin_username = body.get("admin_username") or user.get("username", "admin")
    action = body.get("action")
    details = body.get("details", "")

    if not action:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="action is required",
        )

    await db["audit_logs"].insert_one({
        "admin_username": admin_username,
        "action": action,
        "details": details,
        "timestamp": datetime.now(timezone.utc),
    })

    return BaseResponse(success=True, message="Audit log created successfully.")