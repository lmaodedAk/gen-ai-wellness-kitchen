"""
AI service — now powered by Groq (llama-3.3-70b-versatile).

Public surface is unchanged so all routers keep working:
  generate_recipe(prompt, token_budget)
  generate_recipe_stream(prompt)
  analyze_image_for_ingredients(image_base64)
  _init_models()
"""
from groq import Groq, AsyncGroq
import json
import logging
import re
import asyncio
import base64
from typing import Optional
from core.config import settings

logger = logging.getLogger(__name__)

# ── Model chain: try each in order until one works ───────────────────────────
# llama-3.3-70b-versatile  – best quality, generous free tier
# llama3-8b-8192           – lighter fallback (faster)
MODEL_CHAIN = [
    "llama-3.3-70b-versatile",
    "llama3-8b-8192",
    "gemma2-9b-it",
]

# Singleton async client
_async_client: Optional[AsyncGroq] = None
_sync_client: Optional[Groq] = None


def _get_async_client() -> AsyncGroq:
    global _async_client
    if _async_client is None:
        _async_client = AsyncGroq(api_key=settings.groq_api_key)
    return _async_client


def _get_sync_client() -> Groq:
    global _sync_client
    if _sync_client is None:
        _sync_client = Groq(api_key=settings.groq_api_key)
    return _sync_client


def _init_models():
    """Pre-warm clients at startup — no cold start on first request."""
    try:
        _get_async_client()
        _get_sync_client()
        logger.info(f"Groq clients ready. Primary model: {MODEL_CHAIN[0]}")
    except Exception as e:
        logger.warning(f"Groq pre-warm failed (will retry on first request): {e}")


# ── Token budgets ─────────────────────────────────────────────────────────────
TOKEN_BUDGETS = {
    "default":    2200,
    "cook_steps": 2200,
    "meal_plan":  3500,
    "quick":       700,
}


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


async def _call_with_fallback(system_text: str, user_text: str, max_tokens: int) -> str:
    """Try each Groq model in order; return first successful response text."""
    client = _get_async_client()
    last_error = None

    for model_name in MODEL_CHAIN:
        try:
            response = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_text},
                    {"role": "user",   "content": user_text},
                ],
                temperature=0.4,
                max_tokens=max_tokens,
                top_p=0.85,
            )
            text = response.choices[0].message.content
            logger.info(f"Groq success via {model_name}")
            return text
        except Exception as e:
            err_str = str(e)
            logger.warning(f"Groq model {model_name} failed: {err_str[:120]}")
            last_error = e
            # Only retry on rate-limit errors
            if "429" not in err_str and "rate_limit" not in err_str.lower():
                break
            await asyncio.sleep(0.5)

    raise ValueError(f"All Groq models failed. Last error: {last_error}")


async def analyze_image_for_ingredients(image_base64: str) -> list:
    """
    Detect food ingredients from a base64 image using Groq vision (llama-4-scout).
    Falls back to an empty list if vision is unavailable.
    """
    # Strip data URL prefix
    if "," in image_base64:
        header, raw = image_base64.split(",", 1)
        mime = header.split(":")[1].split(";")[0] if ":" in header else "image/jpeg"
    else:
        raw = image_base64
        mime = "image/jpeg"

    client = _get_async_client()

    # Vision-capable models on Groq
    vision_models = ["meta-llama/llama-4-scout-17b-16e-instruct", "llama-3.2-11b-vision-preview"]
    last_err = None

    for model_name in vision_models:
        try:
            response = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime};base64,{raw}"
                                },
                            },
                            {
                                "type": "text",
                                "text": (
                                    "Look at this food/ingredient photo carefully. "
                                    "List ONLY the raw food ingredients you can clearly see. "
                                    "Return a JSON array of ingredient names in English, lowercase. "
                                    "Example: [\"carrot\", \"potato\", \"onion\"]. "
                                    "Include every vegetable, fruit, grain, protein or spice you can see. "
                                    "Do NOT include dishes or meals — only raw ingredients. "
                                    "Return ONLY the JSON array, nothing else."
                                ),
                            },
                        ],
                    }
                ],
                temperature=0.1,
                max_tokens=300,
            )
            text = response.choices[0].message.content.strip()
            # Clean markdown wrappers if any
            if "```" in text:
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
            ingredients = json.loads(text)
            if isinstance(ingredients, list) and len(ingredients) > 0:
                logger.info(f"Groq detected ingredients from image: {ingredients}")
                return [str(i).strip().lower() for i in ingredients if i]
        except Exception as e:
            logger.warning(f"Vision model {model_name} failed: {str(e)[:120]}")
            last_err = e
            if "429" not in str(e) and "rate_limit" not in str(e).lower():
                break

    logger.error(f"Image analysis failed: {last_err}")
    return []  # Caller handles fallback


async def generate_recipe(prompt: dict, token_budget: str = "default") -> dict:
    """
    Generate AI content and return parsed dict.
    prompt must have 'system' and 'user' keys.
    """
    max_tokens = TOKEN_BUDGETS.get(token_budget, TOKEN_BUDGETS["default"])
    system_text = (
        f"{prompt['system']}\n\n"
        "IMPORTANT: Output ONLY valid JSON. No markdown, no explanation, no extra text."
    )
    user_text = prompt["user"]

    try:
        text = await _call_with_fallback(system_text, user_text, max_tokens)
        return _clean_json(text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        raise ValueError(f"AI returned invalid JSON: {e}")
    except Exception as e:
        logger.error(f"AI generation error: {str(e)[:300]}")
        raise ValueError(str(e))


async def generate_recipe_stream(prompt: dict):
    """Stream recipe generation — yields token chunks then final parsed recipe."""
    system_text = (
        f"{prompt['system']}\n\n"
        "IMPORTANT: Output ONLY valid JSON. No markdown."
    )
    user_text = prompt["user"]
    max_tokens = TOKEN_BUDGETS["default"]
    client = _get_async_client()
    full_text = ""

    for model_name in MODEL_CHAIN:
        try:
            stream = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_text},
                    {"role": "user",   "content": user_text},
                ],
                temperature=0.4,
                max_tokens=max_tokens,
                top_p=0.85,
                stream=True,
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    full_text += delta
                    yield {"type": "token", "token": delta}

            # Streamed successfully — parse and return
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
            if "429" not in err_str and "rate_limit" not in err_str.lower():
                yield {"type": "error", "message": f"AI Error: {err_str}"}
                return
            await asyncio.sleep(0.5)

    yield {"type": "error", "message": "All AI models are busy. Please wait 10 seconds."}
