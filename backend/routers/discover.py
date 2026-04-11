from fastapi import APIRouter, HTTPException, Header
from core.database import get_collection
from core.dependencies import get_user
from services.gemini_service import generate_recipe
from services.rag_service import retrieve, format_context
from bson import ObjectId
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/discover", tags=["Discover"])

@router.get("/generate")
async def generate_discover_ideas(authorization: str = Header(None)):
    """
    Fast RAG-powered dish discovery.
    Uses this week's meals + pantry items to suggest what to cook next.
    """
    user = await get_user(authorization)

    diet_prefs = user.get("dietary_preferences", [])
    if "vegan" in diet_prefs:
        diet_type = "vegan"
    elif "vegetarian" in diet_prefs:
        diet_type = "vegetarian"
    else:
        diet_type = "non-vegetarian"

    # 1. Get pantry items (what user HAS right now)
    pantry_cursor = get_collection("pantry").find(
        {"user_id": user["_id"], "freshness_status": {"$ne": "expired"}}
    ).limit(30)
    pantry_items = []
    async for p in pantry_cursor:
        pantry_items.append(p.get("name", ""))
    pantry_str = ", ".join(pantry_items) if pantry_items else "common Indian pantry staples"

    # 2. Get this week's logged meals (what they ate recently)
    week_ago = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    intake_cursor = get_collection("food_intake").find(
        {"user_id": user["_id"], "date": {"$gte": week_ago}}
    ).limit(7)
    recent_meals = []
    async for m in intake_cursor:
        recent_meals.append(m.get("recipe_title") or m.get("title", ""))
    recent_str = ", ".join(set(recent_meals)) if recent_meals else "nothing logged yet this week"

    # 3. RAG semantic context (flavor profile from all history)
    dietary_filter = "vegan" if "vegan" in diet_prefs else ("veg" if "vegetarian" in diet_prefs else None)
    rag_docs = await retrieve(
        f"favorite healthy Indian meals",
        str(user["_id"]),
        top_k=5,
        dietary_filter=dietary_filter
    )
    rag_ctx = format_context(rag_docs)

    prompt = {
        "system": "You are a smart kitchen AI. Suggest dishes the user can make RIGHT NOW using their pantry. Output ONLY valid JSON.",
        "user": f"""
Suggest 6 personalized dish ideas. Be FAST and PRACTICAL.

DIET: {diet_type}
{"STRICT RULE: You MUST NOT suggest any non-vegetarian dish. NO chicken, mutton, fish, egg, prawn, beef, pork, lamb, shrimp, crab, tuna, salmon, keema, or any meat/seafood. ONLY pure vegetarian dishes. Violation of this rule is unacceptable." if diet_type == "vegetarian" else "STRICT RULE: ONLY vegan dishes. NO meat, fish, eggs, dairy, ghee, paneer, curd. Plants only." if diet_type == "vegan" else "Include meat/fish/eggs in main meals."}

PANTRY AVAILABLE: {pantry_str}
(Prefer ingredients from this list!)

THIS WEEK ALREADY ATE: {recent_str}
(MUST suggest different dishes — no repeats!)

PAST FAVORITES (from memory):
{rag_ctx or "No history yet — suggest popular healthy Indian dishes."}

RULES:
- Focus on dishes the user can make TODAY with their pantry
- Avoid dishes requiring ingredients not in pantry if possible
- Be creative but realistic
- Mix meal types: breakfast, lunch, dinner, snack

Return ONLY this JSON:
{{
  "based_on": "Short summary: what patterns you found + what pantry items you're using",
  "discoveries": [
    {{
      "title": "Dish name",
      "hindi_name": "हिंदी नाम",
      "cuisine": "Indian cuisine type",
      "meal_type": "breakfast|lunch|dinner|snack",
      "calories": 380,
      "time_minutes": 25,
      "difficulty": "easy|medium|hard",
      "diet_type": "{'vegan' if diet_type == 'vegan' else 'veg' if diet_type == 'vegetarian' else 'non-veg'}",
      "why_fits": "Why this matches their history + uses their pantry",
      "key_ingredients": ["ing1", "ing2", "ing3"],
      "pantry_match": true
    }}
  ]
}}
"""
    }

    result = await generate_recipe(prompt, token_budget="default")
    if not result or not isinstance(result, dict):
        result = {"based_on": "Based on your profile.", "discoveries": []}

    return {"success": True, "data": result}
