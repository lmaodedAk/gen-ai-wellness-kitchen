from fastapi import APIRouter, HTTPException, Header
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from core.database import get_collection
from core.dependencies import get_user

router = APIRouter(prefix="/pantry", tags=["Pantry"])

def ok(data): return {"success": True, "data": data}

def freshness(expiry_date) -> tuple:
    if not expiry_date:
        return "fresh", 999
    now = datetime.utcnow().replace(tzinfo=timezone.utc)
    if expiry_date.tzinfo is None:
        expiry_date = expiry_date.replace(tzinfo=timezone.utc)
    days = (expiry_date - now).days
    if   days <  0: status = "expired"
    elif days <= 2: status = "expiring"
    elif days <= 7: status = "use_soon"
    else:           status = "fresh"
    return status, max(0, days)

def fmt(item: dict) -> dict:
    f_status, days = freshness(item.get("expiry_date"))
    return {
        "id":               str(item["_id"]),
        "user_id":          str(item["user_id"]),
        "name":             item["name"],
        "hindi_name":       item.get("hindi_name",""),
        "quantity":         item["quantity"],
        "unit":             item["unit"],
        "category":         item["category"],
        "expiry_date":      item["expiry_date"].isoformat()
                            if item.get("expiry_date") else None,
        "freshness_status": f_status,
        "days_until_expiry":days,
        "is_staple":        item.get("is_staple", False)
    }

# IMPORTANT: /expiring MUST be before /{user_id}
@router.get("/expiring")
async def get_expiring(
    days: int = 5,
    authorization: str = Header(None)
):
    user = await get_user(authorization)
    cutoff = datetime.utcnow() + timedelta(days=days)
    cursor = get_collection("pantry_items").find({
        "user_id": ObjectId(str(user["_id"])),
        "expiry_date": {
            "$lte": cutoff,
            "$gte": datetime.utcnow()
        }
    }).sort("expiry_date", 1)
    items = []
    async for item in cursor:
        items.append(fmt(item))
    return ok(items)

@router.get("/{user_id}")
async def get_pantry(
    user_id: str,
    authorization: str = Header(None)
):
    await get_user(authorization)
    cursor = get_collection("pantry_items").find(
        {"user_id": ObjectId(user_id)}
    ).sort("expiry_date", 1)
    items = []
    async for item in cursor:
        items.append(fmt(item))
    return ok(items)

@router.post("/item")
async def add_item(
    body: dict,
    authorization: str = Header(None)
):
    user = await get_user(authorization)
    # Safely parse expiry_date — reject empty string
    expiry_raw = body.get("expiry_date")
    if expiry_raw and isinstance(expiry_raw, str) and expiry_raw.strip():
        try:
            body["expiry_date"] = datetime.fromisoformat(
                expiry_raw.replace("Z", "+00:00")
            )
        except ValueError:
            body["expiry_date"] = None
    else:
        body["expiry_date"] = None

    body["user_id"]    = user["_id"]
    body["created_at"] = datetime.utcnow()
    f_status, days     = freshness(body.get("expiry_date"))
    body["freshness_status"]  = f_status
    body["days_until_expiry"] = days
    result = await get_collection("pantry_items").insert_one(body)
    body["_id"] = result.inserted_id
    return ok(fmt(body))


@router.put("/item/{id}")
async def update_item(
    id: str,
    body: dict,
    authorization: str = Header(None)
):
    await get_user(authorization)
    if isinstance(body.get("expiry_date"), str):
        body["expiry_date"] = datetime.fromisoformat(
            body["expiry_date"].replace("Z", "+00:00")
        )
    if body.get("expiry_date"):
        f, d = freshness(body["expiry_date"])
        body["freshness_status"]  = f
        body["days_until_expiry"] = d
    await get_collection("pantry_items").update_one(
        {"_id": ObjectId(id)},
        {"$set": body}
    )
    updated = await get_collection("pantry_items").find_one(
        {"_id": ObjectId(id)}
    )
    return ok(fmt(updated))

@router.delete("/item/{id}")
async def delete_item(
    id: str,
    authorization: str = Header(None)
):
    await get_user(authorization)
    await get_collection("pantry_items").delete_one(
        {"_id": ObjectId(id)}
    )
    return ok({"deleted": id})

@router.post("/optimize")
async def optimize(authorization: str = Header(None)):
    user = await get_user(authorization)
    from services.leftover_optimizer import get_prioritized_ingredients
    from services.rag_service import retrieve, format_context
    db = get_collection("pantry_items").database
    pantry = await get_prioritized_ingredients(
        str(user["_id"]), db
    )
    expiring = pantry["critical"] + pantry["soon"]
    if not expiring:
        return ok({
            "suggestions": [],
            "message": "No items expiring soon! 🌟"
        })
    ings  = [x["name"] for x in expiring[:5]]
    docs  = await retrieve(
        f"{' '.join(ings)} indian recipe",
        str(user["_id"]),
        top_k=3
    )
    suggestions = [{
        "title":   d["metadata"].get("title",""),
        "cuisine": d["metadata"].get("cuisine",""),
        "tags":    d["metadata"].get("health_tags","").split(",")
    } for d in docs]
    return ok({
        "suggestions": suggestions,
        "expiring_items": [x["name"] for x in expiring],
        "message": pantry["expiry_hint"]
    })
