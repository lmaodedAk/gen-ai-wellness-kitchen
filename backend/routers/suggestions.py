from fastapi import APIRouter, HTTPException, Header
from core.database import get_collection
from core.dependencies import get_user
from services.gemini_service import generate_recipe
from services.health_engine import compute_health_profile
from services.rag_service import retrieve, format_context
from bson import ObjectId

router = APIRouter(
    prefix="/suggestions",
    tags=["Suggestions"]
)
def ok(d): return {"success": True, "data": d}

GOAL_MESSAGES = {
    "weight_loss": "Help me lose weight with low-calorie, high-fiber, high-protein Indian meals",
    "muscle_gain": "Help me gain muscle with high-protein, complex-carb Indian meals",
    "maintain":    "Help me maintain weight with balanced nutritious Indian meals",
    "gut_health":  "Help me improve gut health with probiotic, fiber-rich Indian meals"
}

@router.get("/daily")
async def get_daily_suggestions(
    authorization: str = Header(None)
):
    """
    Returns 6 personalized dish suggestions for today
    based on user's health goal, preferences,
    dietary type (veg/non-veg), and RAG history
    """
    user = await get_user(authorization)
    health = await compute_health_profile(user)
    
    goal_msg = GOAL_MESSAGES.get(
        user.get("health_goal","maintain"),
        GOAL_MESSAGES["maintain"]
    )
    diet_type = "vegetarian" \
        if "vegetarian" in user.get("dietary_preferences",[]) \
        else "non-vegetarian (includes chicken, fish, eggs, meat)"
    cuisines = user.get("cuisine_preference", ["any"])

    # Single RAG lookup combining goal + diet, using new dietary_filter
    dietary_filter = "vegan" if "vegan" in user.get("dietary_preferences",[]) else ("veg" if "vegetarian" in user.get("dietary_preferences",[]) else None)
    
    rag_docs = await retrieve(
        f"{user.get('health_goal','maintain')} healthy Indian meal",
        str(user["_id"]),
        top_k=4,
        dietary_filter=dietary_filter
    )
    rag_ctx = format_context(rag_docs)

    # Recent meals for variety (limit 5)
    recent_cursor = get_collection("food_intake").find(
        {"user_id": user["_id"]}
    ).sort("logged_at", -1).limit(5)
    recent_meals = []
    async for m in recent_cursor:
        recent_meals.append(m.get("recipe_title", ""))
    
    prompt = {
        "system": """You are a nutrition-focused Indian 
        chef AI. Suggest healthy personalized meals.
        Output ONLY valid JSON.""",
        
        "user": f"""
Suggest 6 personalized meal ideas for today.

User profile:
- Health goal: {user.get('health_goal','maintain')}
- Goal message: {goal_msg}
- Diet type: {diet_type}
- Cuisine preference: {', '.join(cuisines)}
- BMI: {health['bmi']} ({health['bmi_category']})
- Daily calorie target: {health['calorie_target']} kcal
- Dietary restrictions: {', '.join(user.get('dietary_preferences',[])) or 'none'}
{'STRICT RULE: You MUST NOT suggest any non-vegetarian dish. NO chicken, mutton, fish, egg, prawn, beef, pork, lamb, shrimp, crab, tuna, salmon, keema, or any meat/seafood. ONLY pure vegetarian dishes.' if 'vegetarian' in user.get('dietary_preferences', []) else 'STRICT RULE: ONLY vegan dishes. NO meat, fish, eggs, dairy, ghee, paneer, curd. Plants only.' if 'vegan' in user.get('dietary_preferences', []) else ''}

Recipes this user has made/liked before (from RAG):
{rag_ctx}

Recently eaten (avoid suggesting same dishes):
{', '.join(recent_meals) or 'nothing yet'}

IMPORTANT: Do NOT suggest dishes from the 
recently eaten list above.
Suggest NEW dishes they haven't tried yet.

Suggestion system schema:
{{
  "goal_tip": "Motivational tip",
  "suggestions": [
    {{
      "title": "Dish name",
      "hindi_name": "हिंदी नाम", 
      "meal_type": "breakfast|lunch|dinner|snack",
      "cuisine": "cuisine name",
      "calories": 350,
      "time_minutes": 20,
      "why_good": "Why this is perfect for their goal",
      "main_ingredients": ["ing1","ing2","ing3"],
      "health_score": 8,
      "diet_type": "veg|non-veg|vegan",
      "difficulty": "easy|medium|hard"
    }}
  ],
  "history_suggestions": [
    {{
      "title": "Dish name",
      "hindi_name": "हिंदी नाम",
      "meal_type": "breakfast|lunch|dinner|snack",
      "cuisine": "cuisine name",
      "calories": 350,
      "time_minutes": 20,
      "why_good": "Connect this to their RAG recipe history",
      "main_ingredients": ["ing1"],
      "health_score": 8,
      "diet_type": "veg|non-veg",
      "difficulty": "easy"
    }}
  ]
}}

Make 4 new suggestions.
Make 2 history_suggestions explicitly based on the rag context.
Mix Indian regional cuisines.
"""
    }
    
    result = await generate_recipe(prompt, token_budget="default")
    return ok(result)

@router.post("/meal-plan/smart")
async def smart_meal_plan(
    body: dict,
    authorization: str = Header(None)
):
    """
    Generate a full week meal plan based on:
    - health goal
    - veg/non-veg preference  
    - cuisine preferences
    - leftover optimization
    """
    user = await get_user(authorization)
    health = await compute_health_profile(user)
    
    diet_type = "vegetarian" \
        if "vegetarian" in user.get("dietary_preferences",[]) \
        else "non-vegetarian"
    
    goal = user.get("health_goal","maintain")
    cuisines = user.get("cuisine_preference",["any"])
    
    prompt = {
        "system": "You are a nutritionist. Create a balanced weekly meal plan. Output ONLY valid JSON.",
        "user": f"""
Create a 7-day meal plan (Monday to Sunday).

User:
- Goal: {goal}
- Diet: {diet_type}  
- Cuisine: {', '.join(cuisines)}
- Daily calorie target: {health['calorie_target']} kcal
- Protein target: {health['protein_g']}g
- Restrictions: {', '.join(user.get('dietary_preferences',[])) or 'none'}

Rules:
- Weight loss: keep each day under {health['calorie_target']} kcal
- Muscle gain: include high-protein meals every day
- Vary cuisines throughout the week
- Include Indian breakfast options (poha, idli, paratha etc)
- No repeat of same dish twice in the week

Return JSON:
{{
  "week_summary": "Brief summary of the plan",
  "total_weekly_calories": 14000,
  "plan": [
    {{
      "day": "Monday",
      "date_offset": 0,
      "meals": {{
        "breakfast": {{
          "title": "dish name",
          "hindi_name": "हिंदी",
          "calories": 350,
          "time_minutes": 15,
          "cuisine": "south_indian",
          "why": "High fiber start to the day"
        }},
        "lunch": {{...same structure}},
        "dinner": {{...same structure}},
        "snack": {{
          "title": "dish name",
          "hindi_name": "हिंदी",
          "calories": 150,
          "time_minutes": 5,
          "cuisine": "street_food",
          "why": "Light protein snack"
        }}
      }},
      "day_total_calories": 1800
    }}
  ]
}}
"""
    }
    
    result = await generate_recipe(prompt, token_budget="meal_plan")
    return ok(result)
