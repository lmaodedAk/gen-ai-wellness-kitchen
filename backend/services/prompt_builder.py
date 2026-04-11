def build_recipe_prompt(
    ingredients: list,
    health: dict,
    rag_context: str,
    pantry: dict,
    meal_type: str,
    cuisine: str,
    max_time: int,
    user_prefs: dict
) -> dict:

    system = """You are 'Wellness AI', an expert health chef and nutritionist.
Create delicious recipes that match the user's health goals and use their requested ingredients.
If user requests chicken/fish/beef - use it exactly (do NOT substitute).
Output ONLY valid JSON. No text outside JSON."""

    critical = [x["name"] for x in pantry.get("critical", [])]
    soon     = [x["name"] for x in pantry.get("soon", [])]
    meal_budget = health["meal_split"].get(
        meal_type,
        health["calorie_target"] // 3
    )

    user_msg = f"""Create a recipe for: {', '.join(ingredients) if ingredients else 'a healthy meal'}

User: BMI {health['bmi']} ({health['bmi_category']}), Goal: {user_prefs.get('health_goal','maintain')}, {meal_type} budget: {meal_budget} kcal
Cuisine: {cuisine if cuisine != 'any' else 'any'}, Max time: {max_time}min, Allergies: {', '.join(user_prefs.get('allergies',[])) or 'none'}
Expiring items to use first: {', '.join(critical + soon) or 'none'}
RAG context (user history): {rag_context[:300] if rag_context else 'none'}

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
