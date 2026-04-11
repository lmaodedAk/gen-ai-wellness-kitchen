from fastapi import APIRouter, Header, HTTPException
from core.dependencies import get_user
from core.database import get_collection
from bson import ObjectId
from services.rag_service import (
    retrieve, format_context,
    index_recipe, is_rag_ready
)

router = APIRouter(prefix="/rag", tags=["RAG"])

def ok(d): return {"success": True, "data": d}

@router.get("/status")
async def rag_status(
    authorization: str = Header(None)
):
    await get_user(authorization)
    status = await is_rag_ready()
    return ok(status)

@router.get("/search")
async def search_recipes(
    q: str,
    authorization: str = Header(None)
):
    user = await get_user(authorization)
    results = await retrieve(
        q, str(user["_id"]), top_k=5
    )
    return ok({
        "query":   q,
        "results": results,
        "context": format_context(results)
    })
