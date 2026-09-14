"""
Activity Records Router
=======================

Endpoints:
    - GET /activity — List all activity records (system-wide feed)
"""

from fastapi import APIRouter, Depends, Query

from app.database import get_database
from app.dependencies.auth import get_current_admin
from app.schemas.common import ErrorResponse
                                                                             
router = APIRouter(prefix="/activity", tags=["Activity Records"])



@router.get(
    "",
    responses={401: {"model": ErrorResponse}},
)
async def list_activity_records(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db=Depends(get_database),
    _=Depends(get_current_admin),
):
    """                             
    List all activity records (admin view).

    Query params:
        - skip:  Pagination offset
        - limit: Records per page
    """
    cursor = db["activity_records"].find().sort("date", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db["activity_records"].count_documents({})

    from app.services.client_service import _serialize
    return {"data": [_serialize(d) for d in docs], "total": total}