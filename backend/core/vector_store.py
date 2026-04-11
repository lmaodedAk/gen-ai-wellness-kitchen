# Uses local ChromaDB - no server needed, no Docker
import chromadb
from .config import settings
import logging

logger = logging.getLogger(__name__)

class VectorStore:
    client = None
    recipes_collection = None
    user_history_collection = None

_vs = VectorStore()

def init_vector_store():
    try:
        # PersistentClient stores data locally on disk
        _vs.client = chromadb.PersistentClient(
            path=settings.chroma_path
        )
        _vs.recipes_collection = (
            _vs.client.get_or_create_collection(
                name="recipes",
                metadata={"hnsw:space": "cosine"}
            )
        )
        _vs.user_history_collection = (
            _vs.client.get_or_create_collection(
                name="user_history",
                metadata={"hnsw:space": "cosine"}
            )
        )
        count = _vs.recipes_collection.count()
        logger.info(
            f"✅ ChromaDB ready locally — "
            f"{count} recipes indexed"
        )
    except Exception as e:
        logger.warning(f"⚠️ ChromaDB init failed: {e}")

def get_vector_store():
    if _vs.client is None:
        init_vector_store()
    return _vs
