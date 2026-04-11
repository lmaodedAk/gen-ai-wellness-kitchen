"""
Shared authentication dependency.
All routers import get_user() from here instead of duplicating it.
"""
from fastapi import HTTPException
from bson import ObjectId
from core.database import get_collection
from core.security import decode_access_token


async def get_user(authorization: str) -> dict:
    """Extract and validate the current user from a Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, detail="No token")
    payload = decode_access_token(authorization.split(" ")[1])
    user = await get_collection("users").find_one(
        {"_id": ObjectId(payload["sub"])}
    )
    if not user:
        raise HTTPException(404, detail="User not found")
    return user
