from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from datetime import datetime
from bson import ObjectId
import json
from core.database import get_collection
from core.dependencies import get_user
from services.gemini_service import (
    generate_recipe, generate_recipe_stream
)
from services.health_engine import compute_health_profile
from services.rag_service import (
    index_recipe, retrieve, format_context
)
from services.leftover_optimizer import (
    get_prioritized_ingredients
)
from services.prompt_builder import build_recipe_prompt
from services.rule_checker import check_recipe

router = APIRouter(prefix="/recipes", tags=["Recipes"])

def ok(data, warnings=None):
    return {"success": True, "data": data, "warnings": warnings or []}

@router.post("/generate")
async def generate(
    body: dict,
    authorization: str = Header(None)
):
    user = await get_user(authorization)
    try:
        db = get_collection("users").database

        # Get all context
        health   = await compute_health_profile(user)
        pantry   = await get_prioritized_ingredients(
            str(user["_id"]), db
        )
        meal_type = body.get("meal_type", "lunch")
        cuisine   = body.get("cuisine", "any")
        ings      = body.get("ingredients", [])

        # Add meal name as ingredient hint
        if body.get("meal_name"):
            ings.append(body["meal_name"])

        # RAG retrieval
        query = f"{' '.join(ings)} {cuisine} {meal_type}"
        rag_docs = await retrieve(
            query, str(user["_id"]), top_k=5
        )
        rag_ctx = format_context(rag_docs)

        user_prefs = {
            "dietary_preferences": user.get("dietary_preferences",[]),
            "allergies":           user.get("allergies",[]),
            "health_goal":         user.get("health_goal","maintain")
        }

        prompt = build_recipe_prompt(
            ings, health, rag_ctx, pantry,
            meal_type, cuisine,
            body.get("max_time", 45),
            user_prefs
        )

        # Generate with Gemini
        recipe = await generate_recipe(prompt, token_budget="default")

        # Rule check
        recipe["explicitly_requested"] = ings
        checks = check_recipe(recipe, user)

        # Save to MongoDB (NOT indexed in RAG yet — only when user cooks it)
        doc = {
            **recipe,
            "user_id":        user["_id"],
            "is_saved":       False,
            "cooked":         False,
            "generated_from": "ingredients",
            "created_at":     datetime.utcnow()
        }
        result = await get_collection("recipes").insert_one(doc)
        recipe["id"] = str(result.inserted_id)

        return ok(recipe, checks["warnings"])

    except Exception as e:
        raise HTTPException(500, detail=str(e))

@router.get("/generate/stream")
async def stream_generate(
    meal_type: str = "lunch",
    cuisine: str = "any",
    max_time: int = 45,
    ingredients: str = "",
    meal_name: str = "",
    authorization: str = Header(None)
):
    user = await get_user(authorization)

    async def event_gen():
        try:
            db = get_collection("users").database

            yield 'data: {"type":"step","message":"🥘 Checking your pantry..."}\n\n'
            pantry = await get_prioritized_ingredients(
                str(user["_id"]), db
            )

            yield 'data: {"type":"step","message":"💪 Analyzing health profile..."}\n\n'
            health = await compute_health_profile(user)

            ings = [
                i.strip() for i in ingredients.split(",")
                if i.strip()
            ]
            if meal_name:
                ings.append(meal_name)

            yield 'data: {"type":"step","message":"🔍 Finding similar recipes..."}\n\n'
            rag_docs = await retrieve(
                f"{' '.join(ings)} {cuisine} {meal_type}",
                str(user["_id"])
            )
            rag_ctx = format_context(rag_docs)

            user_prefs = {
                "dietary_preferences": user.get("dietary_preferences",[]),
                "allergies":           user.get("allergies",[]),
                "health_goal":         user.get("health_goal","maintain")
            }
            prompt = build_recipe_prompt(
                ings, health, rag_ctx, pantry,
                meal_type, cuisine, max_time, user_prefs
            )

            yield 'data: {"type":"step","message":"👨\u200d🍳 Crafting your recipe..."}\n\n'

            async for chunk in generate_recipe_stream(prompt):
                yield f"data: {json.dumps(chunk)}\n\n"
                if chunk["type"] == "complete":
                    recipe = chunk["recipe"]
                    doc = {
                        **recipe,
                        "user_id":    user["_id"],
                        "is_saved":   False,
                        "cooked":     False,
                        "created_at": datetime.utcnow()
                    }
                    r = await get_collection("recipes").insert_one(doc)
                    recipe["id"] = str(r.inserted_id)
                    recipe["explicitly_requested"] = ings
                    checks = check_recipe(recipe, user)
                    yield f"data: {json.dumps({'type':'warnings','warnings':checks['warnings']})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type':'error','message':str(e)})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"}
    )

@router.get("/user/{user_id}")
async def get_user_recipes(
    user_id: str,
    skip: int = 0,
    limit: int = 12,
    authorization: str = Header(None)
):
    await get_user(authorization)
    cursor = get_collection("recipes").find(
        {"user_id": ObjectId(user_id)}
    ).sort("created_at", -1).skip(skip).limit(limit)
    recipes = []
    async for r in cursor:
        r["id"]      = str(r["_id"])
        r["user_id"] = str(r["user_id"])
        del r["_id"]
        recipes.append(r)
    total = await get_collection("recipes").count_documents(
        {"user_id": ObjectId(user_id)}
    )
    return ok({"recipes": recipes, "total": total})

@router.put("/{id}/save")
async def toggle_save(
    id: str,
    authorization: str = Header(None)
):
    await get_user(authorization)
    coll = get_collection("recipes")
    r = await coll.find_one({"_id": ObjectId(id)})
    if not r:
        raise HTTPException(404, detail="Recipe not found")
    new_val = not r.get("is_saved", False)
    await coll.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"is_saved": new_val}}
    )
    return ok({"is_saved": new_val})

@router.delete("/{id}")
async def delete_recipe(
    id: str,
    authorization: str = Header(None)
):
    await get_user(authorization)
    await get_collection("recipes").delete_one(
        {"_id": ObjectId(id)}
    )
    return ok({"deleted": id})


@router.post("/{id}/cooked")
async def mark_cooked(
    id: str,
    body: dict = {},
    authorization: str = Header(None)
):
    """
    Called when user clicks 'I Cooked This'.
    - Marks recipe as cooked in MongoDB
    - Indexes recipe into user's RAG history (AI Memory)
    - Logs to today's food intake
    """
    user = await get_user(authorization)
    coll = get_collection("recipes")
    recipe = await coll.find_one({"_id": ObjectId(id)})
    if not recipe:
        raise HTTPException(404, "Recipe not found")

    meal_type = body.get("meal_type") or recipe.get("meal_type", "lunch")
    now = datetime.utcnow()

    # Mark cooked in DB
    await coll.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"cooked": True, "cooked_at": now, "meal_type_logged": meal_type}}
    )

    # Index into RAG with cooked=True (this powers AI Memory)
    recipe["id"] = str(recipe["_id"])
    await index_recipe(recipe, str(user["_id"]), cooked=True)

    # Log to today's health intake
    from datetime import date
    nutrition = recipe.get("nutrition", {})
    portion = body.get("portion", 1.0)
    
    await get_collection("food_intake").insert_one({
        "user_id":       user["_id"],
        "recipe_id":     ObjectId(id),
        "recipe_title":  recipe.get("title", ""),
        "title":         recipe.get("title", ""),
        "meal_type":     meal_type,
        "calories":      round(
            nutrition.get("calories", 0) * portion
        ),
        "protein_g":     round(
            nutrition.get("protein_g", 0) * portion, 1
        ),
        "carbs_g":       round(
            nutrition.get("carbs_g", 0) * portion, 1
        ),
        "fat_g":         round(
            nutrition.get("fat_g", 0) * portion, 1
        ),
        "portion":       portion,
        "date":          date.today().isoformat(),
        "logged_at":     datetime.utcnow()
    })

    return ok({
        "cooked": True,
        "recipe_id": str(id),
        "message": f"{recipe.get('title', 'Recipe')} logged to your AI Memory!"
    })
