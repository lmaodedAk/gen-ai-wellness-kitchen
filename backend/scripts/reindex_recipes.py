import asyncio
import sys
sys.path.append('.')
from core.database import connect_db, get_collection
from core.vector_store import init_vector_store
from services.rag_service import index_recipe
from core.config import settings

async def reindex_all():
    await connect_db()
    init_vector_store()
    
    db = get_collection("recipes").database
    cursor = db.recipes.find({})
    count = 0
    async for recipe in cursor:
        try:
            user_id = str(recipe.get("user_id", "global"))
            await index_recipe(recipe, user_id)
            count += 1
            print(f"Indexed: {recipe.get('title','?')}")
        except Exception as e:
            print(f"Failed: {e}")
            raise e
    
    print(f"Done. Indexed {count} recipes.")

asyncio.run(reindex_all())
