from fastapi import APIRouter, HTTPException, Header
from datetime import datetime
from bson import ObjectId
from core.database import get_collection
from core.dependencies import get_user
from services.health_engine import compute_health_profile

router = APIRouter(prefix="/health", tags=["Health"])
def ok(d): return {"success": True, "data": d}

@router.get("/stats/{user_id}")
async def get_stats(
    user_id: str,
    authorization: str = Header(None)
):
    user = await get_user(authorization)
    profile = await compute_health_profile(user)
    return ok(profile)

@router.put("/profile/{user_id}")
async def update_profile(
    user_id: str,
    body: dict,
    authorization: str = Header(None)
):
    user = await get_user(authorization)
    fields = [
        "height_cm","weight_kg","age","gender",
        "health_goal","dietary_preferences","allergies",
        "manual_calorie_target"
    ]
    update = {k: v for k, v in body.items() if k in fields}
    merged = {**user, **update}
    profile = await compute_health_profile(merged)
    update.update(profile)
    update["updated_at"] = datetime.utcnow()
    await get_collection("users").update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update}
    )
    await get_collection("health_history").insert_one({
        "user_id":     ObjectId(user_id),
        "weight_kg":   merged["weight_kg"],
        "bmi":         profile["bmi"],
        "recorded_at": datetime.utcnow()
    })
    return ok(profile)

@router.get("/history/{user_id}")
async def get_history(
    user_id: str,
    days: int = 30,
    authorization: str = Header(None)
):
    await get_user(authorization)
    from datetime import timedelta
    since = datetime.utcnow() - timedelta(days=days)
    cursor = get_collection("health_history").find({
        "user_id":    ObjectId(user_id),
        "recorded_at":{"$gte": since}
    }).sort("recorded_at", 1)
    history = []
    async for h in cursor:
        history.append({
            "date":       h["recorded_at"].isoformat(),
            "weight_kg":  h["weight_kg"],
            "bmi":        h["bmi"]
        })
    return ok(history)

@router.post("/intake/log")
async def log_intake(
    body: dict,
    authorization: str = Header(None)
):
    """
    Log what user ate today.
    body: {
      meal_type: breakfast|lunch|dinner|snack,
      recipe_title: str,
      calories: int,
      protein_g: float,
      carbs_g: float,
      fat_g: float,
      portion: float (0.5 = half portion, 1 = full)
    }
    """
    user = await get_user(authorization)
    from datetime import date
    portion = body.get("portion", 1.0)
    # Prepare the payload for RAG
    recipe_meta = {
        "title": body.get("recipe_title", ""),
        "cuisine": "any",
        "meal_type": body.get("meal_type", "lunch"),
        "health_tags": [],
        "nutrition": {
            "calories": body.get("calories", 0),
            "protein_g": body.get("protein_g", 0)
        }
    }
    # Index to AI memory
    from services.rag_service import index_recipe
    await index_recipe(recipe_meta, str(user["_id"]), cooked=True)

    await get_collection("food_intake").insert_one({
        "user_id":       user["_id"],
        "recipe_id":     "",
        "recipe_title":  body.get("recipe_title", ""),
        "title":         body.get("recipe_title", ""),
        "meal_type":     body.get("meal_type", "lunch"),
        "calories":      round(body.get("calories", 0) * portion),
        "protein_g":     round(body.get("protein_g", 0) * portion, 1),
        "carbs_g":       round(body.get("carbs_g", 0) * portion, 1),
        "fat_g":         round(body.get("fat_g", 0) * portion, 1),
        "portion":       portion,
        "date":          date.today().isoformat(),
        "logged_at":     datetime.utcnow()
    })
    
    return ok({"logged": True, "message": "Meal logged and added to AI Memory."})

@router.get("/intake/today")
async def get_today_intake(
    authorization: str = Header(None)
):
    user = await get_user(authorization)
    from datetime import date
    today = date.today().isoformat()
    
    # Query flat food_intake collection
    cursor = get_collection("food_intake").find({
        "user_id": user["_id"],
        "date": today
    })
    
    meals = []
    async for m in cursor:
        meals.append({
            "recipe_title": m.get("recipe_title", 
                             m.get("title", "")),
            "meal_type":    m.get("meal_type", ""),
            "calories":     m.get("calories", 0),
            "protein_g":    m.get("protein_g", 0),
            "carbs_g":      m.get("carbs_g", 0),
            "fat_g":        m.get("fat_g", 0),
        })
    
    total_cal = sum(m["calories"] for m in meals)
    health = await compute_health_profile(user)
    target = health.get("calorie_target", 2000)
    
    return ok({
        "meals":      meals,
        "total_cal":  total_cal,
        "target_cal": target,
        "remaining":  max(0, target - total_cal),
        "percentage": min(100, round(
            total_cal / target * 100
        ) if target > 0 else 0)
    })


@router.get("/cooked-meals")
async def get_cooked_meals(
    days: int = 7,
    authorization: str = Header(None)
):
    user = await get_user(authorization)
    from datetime import date, timedelta
    
    # Build last 7 days list
    result = {}
    for i in range(days):
        d = date.today() - timedelta(days=i)
        result[d.isoformat()] = []
    
    # Query flat food_intake collection
    cursor = get_collection("food_intake").find({
        "user_id": user["_id"]
    }).sort("logged_at", -1).limit(days * 5)
    
    async for m in cursor:
        day_key = m.get("date", "")
        if day_key in result:
            result[day_key].append({
                "title":     m.get("recipe_title",
                              m.get("title", "")),
                "meal_type": m.get("meal_type", ""),
                "calories":  m.get("calories", 0),
            })
    
    calendar = []
    for day_str in sorted(result.keys(), reverse=True):
        meals = result[day_str]
        calendar.append({
            "date":            day_str,
            "meals":           meals,
            "total_calories":  sum(
                m["calories"] for m in meals
            ),
            "cooked_count":    len(meals)
        })
    
    return ok(calendar)
