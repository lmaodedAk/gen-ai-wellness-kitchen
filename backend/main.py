from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from core.database import connect_db, disconnect_db
from core.vector_store import init_vector_store
from routers import (
    auth, recipes, pantry, 
    health, meal_planner, 
    leftovers, suggestions, rag, discover,
    tutor, health_ai, recipe_extras, cook
)
from services.gemini_service import _init_models

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Wellness Kitchen...")
    await connect_db()
    init_vector_store()
    _init_models()  # pre-warm Groq clients — no cold start on first request
    logger.info("Ready!")
    yield
    await disconnect_db()

app = FastAPI(
    title="Wellness Kitchen API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS must be added BEFORE any routes are registered
# allow_credentials must be False when allow_origins=["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

app.include_router(auth.router)
app.include_router(recipes.router)
app.include_router(pantry.router)
app.include_router(health.router)
app.include_router(meal_planner.router)
app.include_router(leftovers.router)
app.include_router(suggestions.router)
app.include_router(rag.router)
app.include_router(discover.router)
app.include_router(tutor.router)
app.include_router(health_ai.router)
app.include_router(recipe_extras.router)
app.include_router(cook.router)

@app.get("/")
async def root():
    return {"message": "Wellness Kitchen API"}

@app.get("/ping")
async def ping():
    return {"status": "ok"}

