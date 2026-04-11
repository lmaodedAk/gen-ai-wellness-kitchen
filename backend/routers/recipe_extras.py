from fastapi import APIRouter, HTTPException, Header
from core.database import get_collection
from core.dependencies import get_user
from services.gemini_service import generate_recipe
from bson import ObjectId

router = APIRouter(prefix="/recipes/extras", tags=["Recipe Extras"])

@router.post("/grocery-list")
async def generate_grocery_list(body: dict, authorization: str = Header(None)):
    """Generate grocery list for a recipe or meal plan"""
    user = await get_user(authorization)
    recipe_title = body.get("recipe_title", "")
    ingredients = body.get("ingredients", [])
    
    if not recipe_title and not ingredients:
        raise HTTPException(400, detail="Recipe title or ingredients required")

    ings_str = "\n".join([
        f"- {i.get('name','')}: {i.get('quantity','')} {i.get('unit','')}"
        for i in ingredients
    ]) if ingredients else f"Ingredients for {recipe_title}"

    prompt = {
        "system": "You are a smart grocery planning AI. Generate precise, organized grocery lists. Output ONLY valid JSON.",
        "user": f"""
Generate a complete grocery shopping list for: {recipe_title}

Known ingredients:
{ings_str}

Return ONLY this JSON:
{{
  "recipe": "{recipe_title}",
  "grocery_list": [
    {{
      "item": "Ingredient name",
      "quantity": "Amount needed",
      "unit": "g/ml/piece/tbsp",
      "category": "Vegetables|Dairy|Grains|Spices|Protein|Other",
      "estimated_cost_inr": 20,
      "can_substitute": "Optional substitute if expensive"
    }}
  ],
  "total_estimated_cost_inr": 150,
  "shopping_tips": ["Buy fresh", "Check expiry"],
  "weekly_tip": "How to use leftovers from this recipe"
}}
"""
    }

    result = await generate_recipe(prompt, token_budget="quick")
    if not result or not isinstance(result, dict):
        result = {"grocery_list": [], "total_estimated_cost_inr": 0}
    
    return {"success": True, "data": result}

@router.post("/substitute")
async def get_substitutes(body: dict, authorization: str = Header(None)):
    """Smart ingredient substitution suggestions"""
    user = await get_user(authorization)
    ingredient = body.get("ingredient", "").strip()
    recipe_context = body.get("recipe_context", "")
    
    if not ingredient:
        raise HTTPException(400, detail="Ingredient name required")

    prompt = {
        "system": "You are a culinary expert specializing in ingredient substitutions. Output ONLY valid JSON.",
        "user": f"""
Suggest substitutes for: {ingredient}
Recipe context: {recipe_context or "general cooking"}

Return ONLY this JSON:
{{
  "original": "{ingredient}",
  "substitutes": [
    {{
      "name": "Substitute ingredient",
      "ratio": "Use X of this for every Y of original",
      "taste_impact": "How it changes the taste",
      "availability": "easy|moderate|hard to find",
      "best_for": "When to use this substitute"
    }}
  ],
  "tip": "General substitution tip for this ingredient"
}}
"""
    }

    result = await generate_recipe(prompt, token_budget="quick")
    if not result or not isinstance(result, dict):
        result = {"substitutes": []}
    
    return {"success": True, "data": result}
