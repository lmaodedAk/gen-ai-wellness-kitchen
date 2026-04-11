from fastapi import APIRouter, HTTPException, Header
from datetime import datetime
from bson import ObjectId
from core.database import get_collection
from core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_access_token, decode_refresh_token
)
from models.schemas import UserRegister, UserLogin

router = APIRouter(prefix="/auth", tags=["Auth"])

def ok(data): 
    return {"success": True, "data": data}

def err(code, msg, status=400):
    raise HTTPException(
        status_code=status,
        detail={"code": code, "message": msg}
    )

def calc_bmi(weight_kg, height_cm):
    h = height_cm / 100
    bmi = round(weight_kg / (h * h), 1)
    if bmi < 18.5: cat = "underweight"
    elif bmi < 25: cat = "normal"
    elif bmi < 30: cat = "overweight"
    else: cat = "obese"
    return bmi, cat

def calc_targets(weight_kg, height_cm, age, gender, goal):
    if gender == "male":
        bmr = 10*weight_kg + 6.25*height_cm - 5*age + 5
    else:
        bmr = 10*weight_kg + 6.25*height_cm - 5*age - 161
    tdee = bmr * 1.4
    cals = round({
        "weight_loss": tdee - 500,
        "muscle_gain": tdee + 300,
        "maintain":    tdee,
        "gut_health":  tdee
    }.get(goal, tdee))
    protein_g = round(weight_kg * 1.0)
    fat_g     = round((cals * 0.30) / 9)
    carbs_g   = round((cals - protein_g*4 - fat_g*9) / 4)
    return {
        "daily_calorie_target": cals,
        "macros": {
            "protein_g": protein_g,
            "carbs_g":   carbs_g,
            "fat_g":     fat_g
        },
        "meal_split": {
            "breakfast": round(cals * 0.25),
            "lunch":     round(cals * 0.35),
            "dinner":    round(cals * 0.30),
            "snack":     round(cals * 0.10)
        }
    }

def format_user(u: dict) -> dict:
    return {
        "id":                  str(u["_id"]),
        "name":                u["name"],
        "email":               u["email"],
        "height_cm":           u["height_cm"],
        "weight_kg":           u["weight_kg"],
        "age":                 u["age"],
        "gender":              u["gender"],
        "dietary_preferences": u.get("dietary_preferences", []),
        "allergies":           u.get("allergies", []),
        "health_goal":         u["health_goal"],
        "bmi":                 u["bmi"],
        "bmi_category":        u["bmi_category"],
        "daily_calorie_target":u["daily_calorie_target"],
        "macros":              u["macros"],
        "meal_split":          u["meal_split"],
        "cuisine_preference":  u.get("cuisine_preference", ["any"]),
        "avatar_url":          u.get("avatar_url", ""),
        "created_at":          u.get("created_at", datetime.utcnow()).isoformat()
    }

@router.post("/register")
async def register(body: UserRegister):
    users = get_collection("users")
    if await users.find_one({"email": body.email}):
        err("AUTH_003", "Email already registered")
    bmi, bmi_cat = calc_bmi(body.weight_kg, body.height_cm)
    targets = calc_targets(
        body.weight_kg, body.height_cm,
        body.age, body.gender, body.health_goal
    )
    doc = {
        "name":                body.name,
        "email":               body.email,
        "password_hash":       hash_password(body.password),
        "height_cm":           body.height_cm,
        "weight_kg":           body.weight_kg,
        "age":                 body.age,
        "gender":              body.gender,
        "dietary_preferences": body.dietary_preferences,
        "allergies":           body.allergies,
        "health_goal":         body.health_goal,
        "cuisine_preference":  body.cuisine_preference,
        "bmi":                 bmi,
        "bmi_category":        bmi_cat,
        "avatar_url":          "",
        **targets,
        "created_at":  datetime.utcnow(),
        "last_active": datetime.utcnow()
    }
    result = await users.insert_one(doc)
    doc["_id"] = result.inserted_id
    token_data = {"sub": str(result.inserted_id)}
    return ok({
        "access_token":  create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type":    "bearer",
        "user":          format_user(doc)
    })

@router.post("/login")
async def login(body: UserLogin):
    users = get_collection("users")
    u = await users.find_one({"email": body.email})
    if not u or not verify_password(
        body.password, u["password_hash"]
    ):
        err("AUTH_001", "Invalid email or password", 401)
    await users.update_one(
        {"_id": u["_id"]},
        {"$set": {"last_active": datetime.utcnow()}}
    )
    token_data = {"sub": str(u["_id"])}
    return ok({
        "access_token":  create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "token_type":    "bearer",
        "user":          format_user(u)
    })

@router.get("/me")
async def get_me(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, detail="No token")
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    u = await get_collection("users").find_one(
        {"_id": ObjectId(user_id)}
    )
    if not u:
        raise HTTPException(404, detail="User not found")
    return ok({"user": format_user(u)})

@router.post("/refresh")
async def refresh_token(body: dict):
    payload = decode_refresh_token(
        body.get("refresh_token", "")
    )
    u = await get_collection("users").find_one(
        {"_id": ObjectId(payload["sub"])}
    )
    if not u:
        raise HTTPException(401, detail="User not found")
    return ok({
        "access_token": create_access_token(
            {"sub": payload["sub"]}
        ),
        "token_type": "bearer"
    })
