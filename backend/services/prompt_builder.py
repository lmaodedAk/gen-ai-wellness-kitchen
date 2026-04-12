import logging
logger = logging.getLogger(__name__)

def build_recipe_prompt(
    ingredients: list,
    health: dict,
    rag_context: str,
    pantry: dict,
    meal_type: str,
    cuisine: str,
    max_time: int,
    user_prefs: dict,
    image_detected: bool = False
) -> dict:

    system = """You are 'Wellness AI', an expert health chef and nutritionist.
Create delicious recipes that match the user's health goals and use their requested ingredients.
CRITICAL RULES:
1. If ingredients are provided, your recipe MUST use those exact ingredients as primary components.
2. If ingredients were DETECTED FROM PHOTO, use ONLY what was detected — do NOT add proteins (chicken, paneer, egg, fish) unless they appear in the detected list.
3. If user requests chicken/fish/beef — use it exactly (do NOT substitute).
4. NEVER generate a recipe that contradicts the ingredient list provided.
Output ONLY valid JSON. No text outside JSON."""

    critical = [x["name"] for x in pantry.get("critical", [])]
    soon     = [x["name"] for x in pantry.get("soon", [])]
    meal_budget = health["meal_split"].get(
        meal_type,
        health["calorie_target"] // 3
    )

    if image_detected and ingredients:
        ing_line = (
            f"DETECTED FROM PHOTO — use ONLY these ingredients as the main components: "
            f"{', '.join(ingredients)}. "
            f"Do NOT add chicken, paneer, fish, egg, or any protein not in this list."
        )
    elif ingredients:
        ing_line = f"Create a recipe using: {', '.join(ingredients)}"
    else:
        ing_line = "Create a healthy meal using pantry items listed below"

    user_msg = f"""{ing_line}

User: BMI {health['bmi']} ({health['bmi_category']}), Goal: {user_prefs.get('health_goal','maintain')}, {meal_type} budget: {meal_budget} kcal
Cuisine: {cuisine if cuisine != 'any' else 'any'}, Max time: {max_time}min
Allergies: {', '.join(user_prefs.get('allergies',[])) or 'none'}
Dietary preferences: {', '.join(user_prefs.get('dietary_preferences',[])) or 'none'}
Expiring pantry items to prioritize: {', '.join(critical + soon) or 'none'}
AI Memory context (user past recipes): {rag_context[:600] if rag_context else 'none'}

Return ONLY this JSON:
{{
  "title": "Dish Name",
  "hindi_name": "हिंदी नाम",
  "description": "2-sentence description of taste and origin",
  "cuisine": "cuisine name",
  "meal_type": "{meal_type}",
  "prep_time_minutes": 10,
  "cook_time_minutes": 25,
  "servings": 2,
  "ingredients": [
    {{
      "name": "ingredient",
      "hindi_name": "name",
      "amount": 200,
      "unit": "g",
      "is_from_pantry": true,
      "is_expiring": false
    }}
  ],
  "instructions": [
    {{
      "step": 1,
      "text": "Clear detailed instruction with heat level, timing, and visual cue",
      "tip": "Chef tip",
      "time_minutes": 3
    }}
  ],
  "nutrition": {{
    "calories": 450,
    "protein_g": 25,
    "carbs_g": 40,
    "fat_g": 15,
    "fiber_g": 5
  }},
  "health_tags": ["high-protein"],
  "allergen_warnings": [],
  "explainability_note": "Why this suits the user",
  "serving_suggestion": "How to plate",
  "reference_search": "YouTube search for this recipe"
}}"""

    return {"system": system, "user": user_msg}

