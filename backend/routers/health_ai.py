from fastapi import APIRouter, HTTPException, Header
from core.database import get_collection
from core.dependencies import get_user
from services.gemini_service import generate_recipe
from bson import ObjectId

router = APIRouter(prefix="/health-ai", tags=["Health AI"])

CONDITIONS = [
    "diabetes", "thyroid", "pcos", "high_cholesterol",
    "hypertension", "anemia", "ibs", "obesity", "underweight",
    "lactose_intolerance", "gluten_intolerance", "uric_acid"
]

@router.post("/analyze")
async def analyze_health(body: dict, authorization: str = Header(None)):
    """Analyze health conditions and generate personalized food advice"""
    user = await get_user(authorization)
    conditions = body.get("conditions", [])
    if not conditions:
        raise HTTPException(400, detail="At least one condition required")

    valid = [c for c in conditions if c in CONDITIONS]
    if not valid:
        raise HTTPException(400, detail="Invalid conditions")

    conditions_str = ", ".join([c.replace("_", " ").title() for c in valid])

    prompt = {
        "system": "You are an expert Indian dietitian and nutritionist. Give precise, evidence-based food advice for health conditions. Output ONLY valid JSON.",
        "user": f"""
Generate comprehensive dietary advice for someone with: {conditions_str}

Return ONLY this JSON:
{{
  "summary": "Brief overview of dietary approach for these conditions",
  "severity": "mild|moderate|strict",
  "foods_to_eat": [
    {{
      "name": "Food item",
      "reason": "Why it helps",
      "frequency": "daily|3x/week|occasionally"
    }}
  ],
  "foods_to_avoid": [
    {{
      "name": "Food item",
      "reason": "Why it's harmful",
      "severity": "strictly avoid|minimize|be careful"
    }}
  ],
  "sample_day_plan": {{
    "breakfast": "Specific breakfast suggestion with portion",
    "lunch": "Specific lunch suggestion with portion",
    "dinner": "Specific dinner suggestion with portion",
    "snacks": "Healthy snack options"
  }},
  "lifestyle_tips": ["Tip 1", "Tip 2", "Tip 3"],
  "warning": "Any important medical disclaimer"
}}
"""
    }

    result = await generate_recipe(prompt, token_budget="default")
    if not result or not isinstance(result, dict):
        result = {"summary": "Could not analyze. Please try again.", "foods_to_eat": [], "foods_to_avoid": []}
    
    return {"success": True, "data": result}

@router.get("/conditions")
async def list_conditions():
    return {"success": True, "data": CONDITIONS}
