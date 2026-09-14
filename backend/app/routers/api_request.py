"""
API Requests Router
===================

Endpoints:
    - GET    /api-requests              — List all API access requests
    - POST   /api-requests              — Create an API access request
    - GET    /api-requests/{id}         — Get a single API request
    - PUT    /api-requests/{id}         — Update an API request
    - DELETE /api-requests/{id}         — Delete an API request
    - POST   /api-requests/{id}/approve — Approve a request (with pricing config)
    - POST   /api-requests/{id}/reject  — Reject a request (with reason)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import get_database
from app.dependencies.auth import get_current_admin, get_current_client, get_current_user
from app.schemas.client import (
    ApiRequestRead,
    ApiRequestApproveRequest,
    ApiRequestRejectRequest,
)
from app.schemas.common import BaseResponse, ErrorResponse, PaginationMetadata
from app.services.client_service import ClientService

router = APIRouter(prefix="/api-requests", tags=["API Requests"])

client_service = ClientService()


@router.get(
    "",
    responses={401: {"model": ErrorResponse}},
)
async def list_api_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status_filter: str = Query("all", alias="status"),
    client_id: str = Query(None),
    db=Depends(get_database),
    user=Depends(get_current_user),
):
    # Clients can only view their own API requests
    if user.get("type") == "client":
        if client_id and client_id != user.get("client_id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
        client_id = user.get("client_id")
    """
    List all API access requests (admin view).

    Query params:
        - skip:    Pagination offset
        - limit:   Records per page
        - status:  Filter by "all" | "Pending Approval" | "Approved" | "Rejected"
        - client_id: Filter by client
    """
    if client_id:
        try:
            from bson import ObjectId
            cid = ObjectId(client_id)
            cursor = db["api_requests"].find({"client_id": cid}).skip(skip).limit(limit)
            docs = await cursor.to_list(length=limit)
            total = await db["api_requests"].count_documents({"client_id": cid})
            from app.services.client_service import _serialize
            serialized = [_serialize(d) for d in docs]
        except Exception:
            serialized = []
            total = 0
        return {
            "data": serialized,
            "total": total,
            "pagination": PaginationMetadata(
                page=(skip // limit) + 1 if limit > 0 else 1,
                limit=limit,
                total=total,
                has_more=(skip + limit) < total,
            ),
        }

    result = await client_service.get_all_api_requests(
        db, skip=skip, limit=limit, status_filter=status_filter
    )
    return {
        "data": result["data"],
        "total": result["total"],
        "pagination": PaginationMetadata(
            page=(skip // limit) + 1 if limit > 0 else 1,
            limit=limit,
            total=result["total"],
            has_more=(skip + limit) < result["total"],
        ),
    }


@router.post(
    "",
    response_model=ApiRequestRead,
    responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def create_api_request(
    body: dict,
    db=Depends(get_database),
    _=Depends(get_current_client),
):
    """
    Create a new API access request (client asks for an API).

    Body:
        - client_id: The client company ID
        - api_name:  The API name being requested
    """
    try:
        result = await client_service.create_api_request(db, body)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/{request_id}",
    response_model=ApiRequestRead,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def get_api_request(
    request_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Get a single API request by ID.
    """
    try:
        result = await client_service.get_api_request_by_id(db, request_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API request not found",
        )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API request not found",
        )
    if isinstance(result, dict) and "_id" in result:
        result["id"] = str(result.pop("_id"))
    return result


@router.put(
    "/{request_id}",
    response_model=ApiRequestRead,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def update_api_request(
    request_id: str,
    body: dict,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Update an API request (e.g., change status).
    """
    from datetime import datetime, timezone
    allowed_fields = {"api_name", "status", "reason"}
    update_data = {k: v for k, v in body.items() if k in allowed_fields and v is not None}
    update_data["reviewed_at"] = datetime.now(timezone.utc)

    try:
        result = await db["api_requests"].update_one(
            {"_id": __import__("bson").ObjectId(request_id)},
            {"$set": update_data}
        )
        if result.modified_count == 0 and result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API request not found",
            )
        doc = await db["api_requests"].find_one({"_id": __import__("bson").ObjectId(request_id)})
        if doc is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API request not found",
            )
        doc["id"] = str(doc.pop("_id"))
        return doc
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API request not found",
        )


@router.delete(
    "/{request_id}",
    response_model=BaseResponse,
    responses={404: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def delete_api_request(
    request_id: str,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Delete an API request.
    """
    from bson import ObjectId
    try:
        result = await db["api_requests"].delete_one({"_id": ObjectId(request_id)})
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API request not found",
            )
        return BaseResponse(success=True, message="API request deleted successfully.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API request not found",
        )


@router.post(
    "/{request_id}/approve",
    response_model=BaseResponse,
    responses={404: {"model": ErrorResponse}, 400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def approve_api_request(
    request_id: str,
    body: ApiRequestApproveRequest,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Approve an API access request and assign the API to the client.

    Body:
        - price_per_hit:            Base price per request
        - success_price_per_hit:    Price for successful requests
        - not_found_price_per_hit:  Price for not-found responses
        - currency:                 "INR" | "USD" | "EUR" | "GBP"
        - request_limit:            Max requests in the limit window
        - limit_frequency:          "Per Minute" | "Per Hour" | "Per Day" | "Per Month" | "Per Year"
        - expiry_date:              Optional expiry date
        - status:                   "Active" | "Suspended"
    """
    try:
        result = await client_service.approve_api_request(db, request_id, body.model_dump())
        return result
    except ValueError as e:
        msg = str(e)
        status_code = (
            status.HTTP_409_CONFLICT
            if "already assigned" in msg.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=msg)


@router.post(
    "/{request_id}/reject",
    response_model=BaseResponse,
    responses={404: {"model": ErrorResponse}, 400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}},
)
async def reject_api_request(
    request_id: str,
    body: ApiRequestRejectRequest,
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """
    Reject an API access request.

    Body:
        - reason: The reason for rejection
    """
    try:
        result = await client_service.reject_api_request(db, request_id, body.reason)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )