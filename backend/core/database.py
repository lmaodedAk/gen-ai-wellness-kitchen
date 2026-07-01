import motor.motor_asyncio
from .config import settings
import logging

logger = logging.getLogger(__name__)

class Database:
    client: motor.motor_asyncio.AsyncIOMotorClient = None
    db = None

_db = Database()

async def connect_db():
    try:
        _db.client = motor.motor_asyncio.AsyncIOMotorClient(
            settings.mongodb_uri,
            maxPoolSize=50,
            serverSelectionTimeoutMS=5000
        )
        # Test the connection
        await _db.client.admin.command("ping")
        _db.db = _db.client[settings.db_name]
        logger.info("✅ MongoDB connected")
        await _create_indexes()
    except Exception as e:
        logger.error(f"❌ MongoDB connection failed: {e}")
        logger.warning("⚠️ Starting without DB — requests will fail until MongoDB is reachable")
        # Don't raise — let the server start so Render keeps the service alive

async def disconnect_db():
    if _db.client:
        _db.client.close()
        logger.info("MongoDB disconnected")

async def _create_indexes():
    db = _db.db
    await db.users.create_index("email", unique=True)
    await db.recipes.create_index("user_id")
    await db.recipes.create_index("created_at")
    await db.pantry_items.create_index("user_id")
    await db.pantry_items.create_index(
        [("user_id", 1), ("expiry_date", 1)]
    )
    await db.meal_plans.create_index(
        [("user_id", 1), ("week_id", 1)]
    )
    logger.info("✅ Database indexes created")

def get_db():
    if _db.db is None:
        raise RuntimeError(
            "Database not connected. "
            "Is MongoDB running on localhost:27017?"
        )
    return _db.db

def get_collection(name: str):
    return get_db()[name]
