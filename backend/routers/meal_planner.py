from fastapi import APIRouter, HTTPException, Header
from datetime import datetime, date, timedelta
from bson import ObjectId
from core.database import get_collection
from core.dependencies import get_user

router = APIRouter(
    prefix="/meal-planner",
    tags=["Meal Planner"]
)
def ok(d): return {"success": True, "data": d}

@router.post("/auto-fill/smart")
async def smart_auto_fill(
    body: dict,
    authorization: str = Header(None)
):
    user = await get_user(authorization)
    from services.health_engine import compute_health_profile
    from services.gemini_service import generate_recipe

    health = await compute_health_profile(user)
    goal_override = body.get("goal")
    goal = goal_override if goal_override else user.get("health_goal", "maintain")
    
    # Override diet preference from request
    # Lets user toggle veg/non-veg at plan time
    diet_override = body.get("diet_type", None)
    if diet_override:
        diet_type = diet_override
    elif "vegetarian" in user.get(
        "dietary_preferences", []
    ):
        diet_type = "vegetarian"
    elif "vegan" in user.get(
        "dietary_preferences", []
    ):
        diet_type = "vegan"
    else:
        diet_type = "non-vegetarian"

    selected_cuisines = body.get(
        "cuisines",
        user.get("cuisine_preference", ["any"])
    )
    
    GOAL_GUIDANCE = {
        "weight_loss": f"""
- Keep total daily calories UNDER {health['calorie_target']} kcal
- Prioritize high fiber foods (dal, vegetables, salads)
- Include protein in every meal to reduce hunger
- Avoid fried foods and heavy curries
- Best foods: Moong dal, grilled chicken, 
  steamed rice, curd, salads""",

        "muscle_gain": f"""
- Hit {health['calorie_target']} kcal MINIMUM each day
- Every meal must have at least 25g protein
- Include complex carbs (brown rice, roti, oats)
- Post-workout: high protein snack mandatory
- Best foods: Paneer, eggs, chicken, 
  dal, milk, nuts, banana""",

        "maintain": f"""
- Stay close to {health['calorie_target']} kcal daily
- Balanced macros: {health['protein_g']}g protein,
  {health['carbs_g']}g carbs, {health['fat_g']}g fat
- Variety is key — different cuisines each day
- Include seasonal vegetables""",

        "gut_health": f"""
- Focus on probiotic foods (curd, idli, dosa)
- High fiber every meal (vegetables, dal, fruits)
- Avoid processed and fried foods
- Include fermented foods daily
- Best foods: Curd rice, idli, 
  dal, leafy vegetables, fruits"""
    }

    prompt = {
        "system": "You are a meal planning AI. Output ONLY valid JSON. No markdown.",
        "user": f"""Create a 7-day meal plan for a {diet_type} person.

Goal: {goal} | Calories/day: {health['calorie_target']} kcal | Cuisines: {', '.join(selected_cuisines[:3])}
Diet rule: {"STRICT RULE: ONLY vegan dishes. NO meat, fish, eggs, dairy, ghee, paneer, curd. Plants only." if diet_type == "vegan" else ("STRICT RULE: You MUST NOT suggest any non-vegetarian dish. NO chicken, mutton, fish, egg, prawn, beef, pork, lamb, shrimp, crab, tuna, salmon, keema, or any meat/seafood. ONLY pure vegetarian dishes." if diet_type == "vegetarian" else "NON-VEG - include chicken/fish/eggs daily")}
No dish repeated twice. All 7 days must be unique.

Return ONLY this compact JSON (all 7 days):
{{
  "plan_title": "7-Day {goal.replace('_',' ').title()} Plan",
  "diet_type": "{diet_type}",
  "daily_target": {health['calorie_target']},
  "week_tip": "one tip",
  "days": [
    {{
      "day": "Monday",
      "day_number": 1,
      "total_calories": {health['calorie_target']},
      "meals": {{
        "breakfast": {{"title": "dish", "cuisine": "type", "calories": 400, "protein_g": 15, "time_minutes": 15, "diet_type": "{"vegan" if diet_type == "vegan" else ("veg" if diet_type == "vegetarian" else "non-veg")}"}},
        "lunch": {{"title": "dish", "cuisine": "type", "calories": 600, "protein_g": 25, "time_minutes": 25, "diet_type": "{"vegan" if diet_type == "vegan" else ("veg" if diet_type == "vegetarian" else "non-veg")}"}},
        "dinner": {{"title": "dish", "cuisine": "type", "calories": 500, "protein_g": 20, "time_minutes": 25, "diet_type": "{"vegan" if diet_type == "vegan" else ("veg" if diet_type == "vegetarian" else "non-veg")}"}},
        "snack": {{"title": "snack", "cuisine": "type", "calories": 200, "protein_g": 8, "time_minutes": 5, "diet_type": "{"vegan" if diet_type == "vegan" else ("veg" if diet_type == "vegetarian" else "non-veg")}"}}
      }}
    }}
  ]
}}

Generate ALL 7 days (Monday to Sunday). Diet: {diet_type}. Cuisines: {', '.join(selected_cuisines[:3])}.
"""
    }

    result = await generate_recipe(prompt, token_budget="meal_plan")

    
    # Validate diet compliance
    if result and "days" in result:
        for day in result["days"]:
            for meal_type, meal in day.get(
                "meals", {}
            ).items():
                if meal and "diet_type" not in meal:
                    if diet_type == "vegan":
                        meal["diet_type"] = "vegan"
                    elif diet_type == "vegetarian":
                        meal["diet_type"] = "veg"
                    else:
                        meal["diet_type"] = "non-veg"

    # Save plan to MongoDB
    from datetime import date
    today = date.today()
    week_num = today.isocalendar()[1]
    week_id = f"{today.year}-W{week_num:02d}"
    
    await get_collection("meal_plans").update_one(
        {"user_id": user["_id"], "week_id": week_id},
        {"$set": {
            "smart_plan": result,
            "diet_type":  diet_type,
            "goal":       goal,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )
    
    return ok({**result, "week_id": week_id})

@router.get("/{user_id}")
async def get_week(
    user_id: str,
    week: str = None,
    authorization: str = Header(None)
):
    await get_user(authorization)
    if not week:
        today = date.today()
        week  = f"{today.year}-W{today.isocalendar()[1]:02d}"
    plan = await get_collection("meal_plans").find_one(
        {"user_id": ObjectId(user_id), "week_id": week}
    )
    if not plan:
        return ok({"week_id": week, "slots": []})
    plan["id"]      = str(plan["_id"])
    plan["user_id"] = str(plan["user_id"])
    del plan["_id"]
    return ok(plan)

@router.post("/slot")
async def add_slot(
    body: dict,
    authorization: str = Header(None)
):
    user = await get_user(authorization)
    today = date.today()
    week  = body.get(
        "week_id",
        f"{today.year}-W{today.isocalendar()[1]:02d}"
    )
    slot = {
        "date":         body["date"],
        "meal_type":    body["meal_type"],
        "recipe_id":    body.get("recipe_id",""),
        "recipe_title": body.get("recipe_title",""),
        "recipe_image": body.get("recipe_image",""),
        "calories":     body.get("calories",0)
    }
    await get_collection("meal_plans").update_one(
        {"user_id": user["_id"], "week_id": week},
        {"$push": {"slots": slot},
         "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True
    )
    return ok(slot)

@router.delete("/slot/{week_id}/{slot_date}/{meal_type}")
async def remove_slot(
    week_id: str,
    slot_date: str,
    meal_type: str,
    authorization: str = Header(None)
):
    user = await get_user(authorization)
    await get_collection("meal_plans").update_one(
        {"user_id": user["_id"], "week_id": week_id},
        {"$pull": {"slots": {
            "date": slot_date,
            "meal_type": meal_type
        }}}
    )
    return ok({"removed": True})

