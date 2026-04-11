from pydantic_settings import BaseSettings
from functools import lru_cache
import os

class Settings(BaseSettings):
    # App
    app_name: str = "Wellness Kitchen API"
    debug: bool = False

    # MongoDB - local, no Docker needed
    mongodb_uri: str = "mongodb://localhost:27017/wellness_kitchen"
    db_name: str = "wellness_kitchen"

    # ChromaDB - local persistent
    chroma_path: str = os.getenv("CHROMA_PATH", "./chroma_db")

    # JWT
    jwt_secret: str = "wellness-kitchen-jwt-secret-min-32-chars"
    jwt_refresh_secret: str = "wellness-refresh-secret-min-32-chars"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days — long enough for dev sessions
    refresh_token_expire_days: int = 30

    # Gemini AI (free)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Embedding model (runs locally, free)
    embedding_model: str = "all-MiniLM-L6-v2"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
