import google.generativeai as genai
import json
import logging
import re
import asyncio
import time
import base64
from core.config import settings

logger = logging.getLogger(__name__)

# ── Model chain: try each in order until one works ──────────────────────────
# gemini-flash-lite-latest = ~2-5s (fastest with quota)
# gemini-2.5-flash         = ~5-8s (fallback)
MODEL_CHAIN = [
    "gemini-flash-lite-latest",
    "gemini-2.5-flash",
    "gemini-flash-latest",
]

_model_cache: dict = {}

def _get_model(name: str):
    """Return cached GenerativeModel instance."""
    if name not in _model_cache:
        genai.configure(api_key=settings.gemini_api_key)
        _model_cache[name] = genai.GenerativeModel(name)
    return _model_cache[name]

def _init_models():
    """Pre-warm models at startup."""
    genai.configure(api_key=settings.gemini_api_key)
    for name in MODEL_CHAIN[:2]:
        try:
            _get_model(name)
        except Exception:
            pass
    logger.info(f"Models pre-warmed: {MODEL_CHAIN[:2]}")

# ── Token budgets (directly controls how long generation takes) ──────────────
TOKEN_BUDGETS = {
    "default":    2200,
    "cook_steps": 2200,
    "meal_plan":  3500,
    "quick":       700,
}

def _build_config(max_tokens: int):
    return genai.GenerationConfig(
        temperature=0.4,
        top_p=0.85,
        max_output_tokens=max_tokens,
    )

def _clean_json(text: str) -> dict:
    """Strip markdown wrappers, extract first complete JSON object."""
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else parts[0]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    brace_count = 0
    end_index = 0
    started = False
    for i, char in enumerate(text):
        if char == '{':
            brace_count += 1
            started = True
        elif char == '}':
            brace_count -= 1
        if started and brace_count == 0:
            end_index = i + 1
            break
    if end_index > 0:
        text = text[:end_index]

    text = re.sub(r',\s*([\]}])', r'\1', text)
    return json.loads(text)


async def _call_with_fallback(full_prompt: str, config: genai.GenerationConfig) -> str:
    """Try each model in order; return first successful response text."""
    last_error = None
    for model_name in MODEL_CHAIN:
        try:
            model = _get_model(model_name)
            # Use async call
            resp = await model.generate_content_async(full_prompt, generation_config=config)
            logger.info(f"AI success via {model_name}")
            return resp.text
        except Exception as e:
            err_str = str(e)
            logger.warning(f"Model {model_name} failed: {err_str[:120]}")
            last_error = e
            if "429" not in err_str and "quota" not in err_str.lower():
                break
            await asyncio.sleep(0.5)
    raise ValueError(f"All models failed. Last error: {last_error}")


async def analyze_image_for_ingredients(image_base64: str) -> list:
    """
    Pass an image to Gemini Vision and return a list of detected food ingredients.
    image_base64: data URL like 'data:image/jpeg;base64,...' or raw base64.
    """
    # Strip data URL prefix if present
    if "," in image_base64:
        header, raw = image_base64.split(",", 1)
        mime = header.split(":")[1].split(";")[0] if ":" in header else "image/jpeg"
    else:
        raw = image_base64
        mime = "image/jpeg"

    image_part = {
        "inline_data": {
            "mime_type": mime,
            "data": raw
        }
    }
    text_part = (
        "Look at this food/ingredient photo carefully. "
        "List ONLY the raw food ingredients you can clearly see. "
        "Return a JSON array of ingredient names in English, lowercase. "
        "Example: [\"carrot\", \"potato\", \"onion\"]. "
        "Include every vegetable, fruit, grain, protein or spice you can see. "
        "Do NOT include dishes or meals — only raw ingredients. "
        "Return ONLY the JSON array, nothing else."
    )

    genai.configure(api_key=settings.gemini_api_key)
    # Use a vision-capable model
    vision_models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.5-flash"]
    last_err = None
    for model_name in vision_models:
        try:
            model = genai.GenerativeModel(model_name)
            resp = model.generate_content(
                [image_part, text_part],
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=300,
                )
            )
            text = resp.text.strip()
            # Clean markdown wrappers if any
            if "```" in text:
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
            ingredients = json.loads(text)
            if isinstance(ingredients, list) and len(ingredients) > 0:
                logger.info(f"AI detected ingredients from image: {ingredients}")
                return [str(i).strip().lower() for i in ingredients if i]
        except Exception as e:
            logger.warning(f"Vision model {model_name} failed: {str(e)[:120]}")
            last_err = e
            if "429" not in str(e) and "quota" not in str(e).lower():
                break
    logger.error(f"Image analysis failed: {last_err}")
    return []  # Return empty list on failure — caller handles fallback


async def generate_recipe(prompt: dict, token_budget: str = "default") -> dict:
    """
    Generate AI content and return parsed dict.
    Uses model fallback chain. Offloads blocking SDK to thread pool.
    """
    max_tokens = TOKEN_BUDGETS.get(token_budget, TOKEN_BUDGETS["default"])
    full_prompt = (
        f"{prompt['system']}\n\n"
        "IMPORTANT: Output ONLY valid JSON. No markdown, no explanation, no extra text.\n\n"
        f"{prompt['user']}"
    )
    config = _build_config(max_tokens)

    try:
        text = await _call_with_fallback(full_prompt, config)
        return _clean_json(text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        raise ValueError(f"AI returned invalid JSON: {e}")
    except Exception as e:
        logger.error(f"AI generation error: {str(e)[:300]}")
        raise ValueError(str(e))


async def generate_recipe_stream(prompt: dict):
    """Stream recipe generation — yields token chunks then final parsed recipe."""
    full_prompt = (
        f"{prompt['system']}\n\n"
        "IMPORTANT: Output ONLY valid JSON. No markdown.\n\n"
        f"{prompt['user']}"
    )
    config = _build_config(TOKEN_BUDGETS["default"])
    full_text = ""

    for model_name in MODEL_CHAIN:
        try:
            model = _get_model(model_name)
            resp = await model.generate_content_async(full_prompt, generation_config=config, stream=True)
            
            async for chunk in resp:
                if chunk.text:
                    full_text += chunk.text
                    yield {"type": "token", "token": chunk.text}
            
            # If we reach here, we successfully streamed
            try:
                recipe = _clean_json(full_text)
                yield {"type": "complete", "recipe": recipe}
            except Exception as e:
                logger.error(f"JSON parse error in stream: {e}")
                yield {"type": "error", "message": "Chef made a typo, please retry!"}
            return

        except Exception as e:
            err_str = str(e)
            logger.warning(f"Stream model {model_name} failed: {err_str[:120]}")
            if "429" not in err_str and "quota" not in err_str.lower():
                yield {"type": "error", "message": f"AI Error: {err_str}"}
                return
            await asyncio.sleep(0.5)

    yield {"type": "error", "message": "All AI models are busy. Please wait 10 seconds."}
