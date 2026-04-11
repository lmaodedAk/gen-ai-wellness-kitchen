import uuid
import logging
from sentence_transformers import SentenceTransformer
from core.vector_store import get_vector_store
from core.config import settings

logger = logging.getLogger(__name__)
_model: SentenceTransformer = None

def get_model():
    global _model
    if not _model:
        logger.info("Loading embedding model...")
        _model = SentenceTransformer(settings.embedding_model)
        logger.info("Embedding model ready")
    return _model

def embed(text: str) -> list:
    return get_model().encode(text).tolist()


async def index_recipe(recipe: dict, user_id: str, cooked: bool = False):
    """
    Index a recipe in ChromaDB.
    Only call with cooked=True when user explicitly marks it as cooked.
    cooked=False: saved to global pool only (for discovery).
    cooked=True:  also saved to user_history (powers AI recommendations).
    """
    vs = get_vector_store()
    title = recipe.get("title", "")
    ings  = " ".join([
        i.get("name", "") if isinstance(i, dict) else str(i)
        for i in recipe.get("ingredients", [])
    ])
    text = (
        f"{title} {ings} "
        f"{recipe.get('cuisine', '')} "
        f"{recipe.get('meal_type', '')} "
        f"{' '.join(recipe.get('health_tags', []))}"
    )
    emb = embed(text)
    meta = {
        "user_id":        str(user_id),
        "title":          title,
        "cuisine":        recipe.get("cuisine", ""),
        "meal_type":      recipe.get("meal_type", ""),
        "health_tags":    ",".join(recipe.get("health_tags", [])),
        "calories":       str(recipe.get("nutrition", {}).get("calories", 0)),
        "cooked":         "true" if cooked else "false",
        # Diet classification for filtering
        "diet_type":      _classify_diet(recipe),
    }

    try:
        if cooked:
            # Only cooked recipes go into user history (powers AI memory)
            vs.user_history_collection.add(
                ids=[str(uuid.uuid4())],
                embeddings=[emb],
                documents=[text],
                metadatas=[meta]
            )

        # Always add to global pool (for discover/search)
        vs.recipes_collection.add(
            ids=[str(uuid.uuid4())],
            embeddings=[emb],
            documents=[text],
            metadatas=[{**meta, "is_global": "true"}]
        )
    except Exception as e:
        logger.warning(f"RAG index warning: {e}")


def _classify_diet(recipe: dict) -> str:
    """Infer diet type from ingredients and health_tags."""
    tags = [t.lower() for t in recipe.get("health_tags", [])]
    title = recipe.get("title", "").lower()
    ings = " ".join([
        i.get("name", "").lower() if isinstance(i, dict) else str(i).lower()
        for i in recipe.get("ingredients", [])
    ])
    non_veg_keywords = {"chicken", "mutton", "fish", "prawn", "beef", "lamb",
                        "pork", "egg", "tuna", "salmon", "shrimp", "crab"}
    combined = title + " " + ings
    for kw in non_veg_keywords:
        if kw in combined:
            return "non-veg"
    if "vegan" in tags or "vegan" in combined:
        return "vegan"
    return "veg"


async def retrieve(
    query: str,
    user_id: str,
    top_k: int = 5,
    dietary_filter: str = None,   # "veg", "vegan", "non-veg", or None
) -> list:
    """
    Retrieve similar recipes from user history (cooked only) + global pool.
    dietary_filter: if set, exclude incompatible diet types.
    """
    vs = get_vector_store()
    q_emb = embed(query)
    results = []

    # Build diet exclusion set
    excluded_types = _build_diet_exclusion(dietary_filter)

    # ── User cooked history (powers AI Memory) ─────────────────────────────
    try:
        count = vs.user_history_collection.count()
        if count > 0:
            r = vs.user_history_collection.query(
                query_embeddings=[q_emb],
                n_results=min(5, count),
                where={"user_id": str(user_id)}
            )
            for i in range(len(r["ids"][0])):
                meta = r["metadatas"][0][i]
                if excluded_types and meta.get("diet_type", "") in excluded_types:
                    continue
                score = (1 - r["distances"][0][i]) * 1.4  # boost personal history
                results.append({"score": score, "metadata": meta, "source": "history"})
    except Exception as e:
        logger.warning(f"User history search: {e}")

    # ── Global recipe pool (for diversity) ────────────────────────────────
    try:
        count = vs.recipes_collection.count()
        if count > 0:
            r = vs.recipes_collection.query(
                query_embeddings=[q_emb],
                n_results=min(8, count)
            )
            for i in range(len(r["ids"][0])):
                meta = r["metadatas"][0][i]
                if excluded_types and meta.get("diet_type", "") in excluded_types:
                    continue
                score = 1 - r["distances"][0][i]
                results.append({"score": score, "metadata": meta, "source": "global"})
    except Exception as e:
        logger.warning(f"Global search: {e}")

    # Deduplicate and sort by score
    seen, unique = set(), []
    for item in sorted(results, key=lambda x: x["score"], reverse=True):
        t = item["metadata"].get("title", "")
        if t not in seen:
            seen.add(t)
            unique.append(item)
    return unique[:top_k]


def _build_diet_exclusion(dietary_filter: str) -> set:
    """Return diet_type values to EXCLUDE given a filter."""
    if not dietary_filter:
        return set()
    if dietary_filter in ("veg", "vegetarian"):
        return {"non-veg"}  # exclude meat
    if dietary_filter in ("vegan",):
        return {"non-veg", "veg"}   # exclude meat AND dairy
    return set()


def format_context(docs: list) -> str:
    if not docs:
        return "No similar recipes found yet."
    lines = ["User's previously cooked recipes:"]
    for i, d in enumerate(docs, 1):
        m = d["metadata"]
        lines.append(
            f"{i}. {m.get('title', '?')} | "
            f"Cuisine: {m.get('cuisine', '?')} | "
            f"Tags: {m.get('health_tags', '')} | "
            f"Source: {d.get('source', '?')}"
        )
    return "\n".join(lines)


async def is_rag_ready() -> dict:
    vs = get_vector_store()
    try:
        recipe_count   = vs.recipes_collection.count()
        history_count  = vs.user_history_collection.count()
        return {
            "ready":          True,
            "global_recipes": recipe_count,
            "user_history":   history_count
        }
    except Exception:
        return {"ready": False, "global_recipes": 0, "user_history": 0}
