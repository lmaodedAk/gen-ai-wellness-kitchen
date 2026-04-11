from fastapi import APIRouter, HTTPException, Header
from core.database import get_collection
from core.dependencies import get_user
from services.gemini_service import generate_recipe
from bson import ObjectId

router = APIRouter(prefix="/tutor", tags=["AI Tutor"])

@router.post("/ask")
async def ask_tutor(body: dict, authorization: str = Header(None)):
    """AI Cooking Tutor — answers any cooking/food question"""
    user = await get_user(authorization)
    question = body.get("question", "").strip()
    if not question:
        raise HTTPException(400, detail="Question required")

    prompt = {
        "system": """You are an expert AI Cooking Tutor with deep knowledge of Indian and global cuisine, nutrition, and culinary science. 
You explain things clearly — like a patient chef teaching a beginner.
Output ONLY valid JSON.""",
        "user": f"""
Answer this cooking/food question thoroughly:

QUESTION: {question}

Return ONLY this JSON:
{{
  "answer": "Clear, detailed main answer (2-4 sentences)",
  "why_important": "Why this technique/ingredient matters in cooking",
  "nutrition_tip": "Relevant nutritional fact if applicable (or empty string)",
  "cooking_tips": ["Tip 1", "Tip 2", "Tip 3"],
  "did_you_know": "An interesting culinary fact related to this question",
  "related_questions": ["Follow-up question 1", "Follow-up question 2"]
}}
"""
    }

    result = await generate_recipe(prompt, token_budget="quick")
    if not result or not isinstance(result, dict):
        result = {"answer": "I couldn't process that. Please try again.", "cooking_tips": []}
    
    return {"success": True, "data": result}
