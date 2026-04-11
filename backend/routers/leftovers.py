from fastapi import APIRouter, HTTPException, Header
from datetime import datetime
from bson import ObjectId
from core.database import get_collection
from core.dependencies import get_user
from services.rag_service import retrieve, format_context
from services.gemini_service import generate_recipe

router = APIRouter(prefix="/leftovers", tags=["Leftovers"])

def ok(d): return {"success": True, "data": d}

@router.post("/log")
async def log_leftover(
    body: dict,
    authorization: str = Header(None)
):
    """
    User tells us what was leftover after cooking.
    body: {
      recipe_id: str (optional),
      recipe_name: str,
      leftover_ingredients: [
        {name: str, amount: float, unit: str}
      ],
      notes: str (optional)
    }
    """
    user = await get_user(authorization)
    doc = {
        "user_id":               user["_id"],
        "recipe_id":             body.get("recipe_id"),
        "recipe_name":           body.get("recipe_name",""),
        "leftover_ingredients":  body.get(
            "leftover_ingredients", []
        ),
        "notes":                 body.get("notes",""),
        "used":                  False,
        "logged_at":             datetime.utcnow()
    }
    result = await get_collection("leftovers").insert_one(doc)
    return ok({
        "id":                   str(result.inserted_id),
        "recipe_name":          doc["recipe_name"],
        "leftover_ingredients": doc["leftover_ingredients"],
        "notes":                doc.get("notes", ""),
        "logged_at":            doc["logged_at"].isoformat()
    })

@router.get("/my")
async def get_my_leftovers(
    authorization: str = Header(None)
):
    user = await get_user(authorization)
    cursor = get_collection("leftovers").find({
        "user_id": user["_id"],
        "used":    False
    }).sort("logged_at", -1)
    items = []
    async for item in cursor:
        item["id"]      = str(item["_id"])
        item["user_id"] = str(item["user_id"])
        del item["_id"]
        items.append(item)
    return ok(items)

@router.post("/suggest")
async def suggest_from_leftovers(
    authorization: str = Header(None)
):
    """
    AI looks at all logged leftovers and suggests
    what dishes can be made from them.
    """
    user = await get_user(authorization)
    
    # Get all unused leftovers
    cursor = get_collection("leftovers").find({
        "user_id": user["_id"],
        "used":    False
    })
    leftovers = []
    async for item in cursor:
        for ing in item.get("leftover_ingredients",[]):
            leftovers.append(ing)
    
    if not leftovers:
        return ok({
            "suggestions": [],
            "message": "No leftovers logged yet!"
        })
    
    # Build ingredient list from leftovers
    ing_names = list(set([
        i["name"] for i in leftovers
    ]))
    
    # Get user health profile
    from services.health_engine import compute_health_profile
    health = await compute_health_profile(user)
    
    # RAG - find similar recipes
    rag_docs = await retrieve(
        f"{' '.join(ing_names)} leftover recipe",
        str(user["_id"]),
        top_k=3
    )
    rag_ctx = format_context(rag_docs)
    
    # Ask Gemini for suggestions
    prompt = {
        "system": """You are a creative Indian chef. 
        Given leftover ingredients, suggest 3 quick 
        dishes that can be made. Be creative and 
        practical. Output valid JSON only.""",
        
        "user": f"""
I have these leftover ingredients:
{', '.join([f"{i.get('amount','')} {i.get('unit','')} {i['name']}" for i in leftovers[:10]])}

User health: BMI {health['bmi']} ({health['bmi_category']}), 
Goal: {user.get('health_goal','maintain')},
Diet: {', '.join(user.get('dietary_preferences',[])) or 'none'}

Similar recipes from history:
{rag_ctx}

Suggest exactly 3 dishes using these leftovers.
Return JSON:
{{
  "suggestions": [
    {{
      "title": "Dish name",
      "hindi_name": "हिंदी नाम",
      "why": "What leftovers it uses",
      "time_minutes": 20,
      "difficulty": "easy|medium|hard",
      "health_benefit": "Why good for this user",
      "ingredients_needed": ["extra item if any"],
      "quick_steps": ["step 1", "step 2", "step 3"]
    }}
  ],
  "message": "You can make these from your leftovers!"
}}"""
    }
    
    result = await generate_recipe(prompt, token_budget="default")
    return ok(result)

@router.put("/{leftover_id}/used")
async def mark_used(
    leftover_id: str,
    authorization: str = Header(None)
):
    await get_user(authorization)
    await get_collection("leftovers").update_one(
        {"_id": ObjectId(leftover_id)},
        {"$set": {"used": True, "used_at": datetime.utcnow()}}
    )
    return ok({"marked_used": True})
