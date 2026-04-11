from pydantic import BaseModel, EmailStr, Field
from pydantic_core import core_schema
from typing import List, Optional, Any
from datetime import datetime
from bson import ObjectId

class PyObjectId(str):
    @classmethod
    def __get_pydantic_core_schema__(
        cls, _source_type: Any, _handler: Any
    ) -> core_schema.CoreSchema:
        return core_schema.json_or_python_schema(
            json_schema=core_schema.str_schema(),
            python_schema=core_schema.union_schema([
                core_schema.is_instance_schema(ObjectId),
                core_schema.chain_schema([
                    core_schema.str_schema(),
                    core_schema.no_info_plain_validator_function(
                        cls.validate
                    )
                ])
            ]),
            serialization=core_schema.plain_serializer_function_ser_schema(
                lambda x: str(x)
            )
        )
    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

class Macros(BaseModel):
    protein_g: int
    carbs_g: int
    fat_g: int

class MealSplit(BaseModel):
    breakfast: int
    lunch: int
    dinner: int
    snack: int

# ── USER SCHEMAS ──────────────────────────────────

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    height_cm: float = Field(..., gt=100, lt=250)
    weight_kg: float = Field(..., gt=30, lt=300)
    age: int = Field(..., gt=10, lt=100)
    gender: str  # "male" or "female"
    dietary_preferences: List[str] = []
    allergies: List[str] = []
    health_goal: str = "maintain"
    cuisine_preference: List[str] = ["any"]

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    height_cm: float
    weight_kg: float
    age: int
    gender: str
    dietary_preferences: List[str]
    allergies: List[str]
    health_goal: str
    bmi: float
    bmi_category: str
    daily_calorie_target: int
    macros: dict
    meal_split: dict
    cuisine_preference: List[str]
    avatar_url: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse

# ── RECIPE SCHEMAS ────────────────────────────────

class IngredientItem(BaseModel):
    name: str
    hindi_name: str = ""
    amount: float = 0
    unit: str = ""
    is_from_pantry: bool = False
    is_expiring: bool = False

class InstructionStep(BaseModel):
    step: int
    text: str
    tip: str = ""
    time_minutes: int = 0

class NutritionInfo(BaseModel):
    calories: int = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    fiber_g: float = 0
    iron_mg: float = 0
    calcium_mg: float = 0

class RecipeGenerateRequest(BaseModel):
    ingredients: List[str] = []
    image_base64: Optional[str] = None
    meal_name: Optional[str] = None
    cuisine: str = "any"
    meal_type: str = "lunch"
    max_time: int = 45
    prefer_expiring: bool = True

# ── PANTRY SCHEMAS ────────────────────────────────

class PantryItemCreate(BaseModel):
    name: str
    hindi_name: str = ""
    quantity: float
    unit: str
    category: str
    expiry_date: datetime
    is_staple: bool = False

class PantryItemResponse(BaseModel):
    id: str
    name: str
    hindi_name: str
    quantity: float
    unit: str
    category: str
    expiry_date: Optional[str]
    freshness_status: str
    days_until_expiry: int
    is_staple: bool
