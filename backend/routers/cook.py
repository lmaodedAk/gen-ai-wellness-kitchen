from fastapi import APIRouter, HTTPException, Header
from core.database import get_collection
from core.dependencies import get_user
from services.gemini_service import generate_recipe
from bson import ObjectId

router = APIRouter(prefix="/cook", tags=["Voice Cook"])

@router.post("/steps")
async def get_cooking_steps(body: dict, authorization: str = Header(None)):
    """Generate detailed bilingual step-by-step cooking instructions (optimized for speed)"""
    user = await get_user(authorization)
    recipe_name = body.get("recipe_name", "").strip()
    if not recipe_name:
        raise HTTPException(400, detail="recipe_name required")

    prompt = {
        "system": "You are an expert chef. Give precise step-by-step cooking instructions. Output ONLY valid JSON.",
        "user": f"""Generate cooking steps for: {recipe_name}

Return ONLY this JSON (exactly 5 steps, bilingual):
{{
  "recipe": "{recipe_name}",
  "total_time_minutes": 30,
  "difficulty": "Easy",
  "steps": [
    {{
      "step": 1,
      "title_en": "Step title",
      "title_hi": "हिंदी शीर्षक",
      "instruction_en": "Detailed instruction with exact amounts, heat level and timing. 2 sentences.",
      "instruction_hi": "2 वाक्यों में सटीक निर्देश।",
      "duration_minutes": 5,
      "tip_en": "One quick chef tip",
      "tip_hi": "एक त्वरित टिप"
    }}
  ],
  "serving_suggestion_en": "How to serve",
  "serving_suggestion_hi": "परोसने का तरीका"
}}

Rules: exactly 5 steps, keep each instruction to max 2 sentences, include quantities and heat settings."""
    }

    result = await generate_recipe(prompt, token_budget="cook_steps")
    if not result or not isinstance(result, dict) or "steps" not in result:
        raise HTTPException(500, detail="Could not generate cooking steps. Please try again.")

    return {"success": True, "data": result}
