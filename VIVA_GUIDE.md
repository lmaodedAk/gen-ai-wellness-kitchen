# 🍽️ GenAI Wellness Kitchen — Complete VIVA Guide
> Generated from full codebase analysis. Every section maps to actual code.

---

# SECTION 1: PROJECT OVERVIEW (All Members)

## What This Project Does (5-Sentence Viva Answer)

GenAI Wellness Kitchen is an AI-powered full-stack web application that generates personalized recipes by combining the user's health profile, pantry inventory, and a memory of what they have cooked before. The system collects user data such as weight, height, age, health goal, and dietary restrictions at registration, then uses this to calculate a daily calorie target and macro breakdown using the Mifflin-St Jeor equation. When a user requests a recipe, the backend runs an 8-step pipeline: fetching pantry and health data, retrieving similar past recipes from ChromaDB using vector embeddings, building a structured prompt, sending it to Google Gemini, and streaming the result token-by-token to the browser using Server-Sent Events. After cooking, the user clicks "I Cooked This," which logs the meal to their nutrition tracker AND permanently indexes the recipe into their personalized ChromaDB history — this is the AI Memory feature that makes future suggestions progressively smarter. The project extends the ideas from the LLaVA-Chef paper by adding real-time vision ingredient detection, RAG-based personalization, JWT-secured multi-user support, and a food-waste reduction system through leftover optimization.

---

## What is RAG and How is it Used HERE?

**RAG = Retrieval Augmented Generation.** Instead of asking an AI to generate from scratch (which is stateless and impersonal), RAG first *retrieves* relevant past information, then uses it to *augment* the AI's prompt so the output is informed by real context.

**In this project specifically:**
- Every time a user clicks "I Cooked This," the recipe's title, ingredients, cuisine, and health tags are converted into a 384-dimensional vector using `sentence-transformers/all-MiniLM-L6-v2` and stored in ChromaDB's `user_history` collection.
- When the user next generates a recipe, the query (e.g., "chicken lunch north_indian") is also converted into a vector, and ChromaDB finds the top-5 most similar past recipes using cosine similarity.
- Those 5 recipes are formatted as text and injected into the Gemini prompt as context, so Gemini can say "this user likes chicken biryani, curd-based dishes, and quick recipes under 30 minutes — so I'll generate something along those lines."

**Without RAG:** Every generation is stateless — the AI has no memory of the user whatsoever.  
**With RAG:** The AI learns from every meal the user has ever cooked, making each generation more personalized.

---

## What is LLaVA-Chef and How This Project Extends It

**LLaVA-Chef** is a research paper that demonstrated using a Large Vision-Language Model (LLaVA) to analyze food photos and generate recipes from visual input. The paper's core contribution was showing that multimodal AI (image + text) can be used for recipe generation.

**This project extends LLaVA-Chef by:**
1. **Adding RAG** — the base paper had no memory/personalization. We add user history via ChromaDB.
2. **Adding health personalization** — LLaVA-Chef didn't consider BMI, calorie targets, or health goals.
3. **Adding real users** — JWT auth, MongoDB, multi-user support (the paper was a research prototype).
4. **Using Gemini instead of LLaVA** — Gemini 1.5 Flash has superior vision + text capability.
5. **Adding food waste reduction** — leftover optimizer and pantry expiry tracking.
6. **Adding rule-based safety** — allergen checking, dietary restriction enforcement.
7. **Adding real-time streaming** — SSE streaming for live recipe generation feedback.

---

## What Makes This Different from a Simple Recipe App

| Feature | Simple Recipe App | This Project |
|---|---|---|
| AI Source | Fixed database of recipes | Gemini generates custom recipes in real-time |
| Personalization | Genre filter | BMI, calorie target, health goal, 30-day history |
| Memory | None | ChromaDB RAG stores every cooked meal |
| Diet Safety | Label-based | Rule checker with allergen + dietary alerts |
| Visual Input | No | Gemini Vision detects ingredients from photos |
| Food Waste | No | Leftover optimizer + expiry-prioritized pantry |
| Streaming | No | SSE streams token-by-token from Gemini |
| Auth | None or simple | JWT access + refresh tokens, bcrypt hashing |

---

# SECTION 2: MEMBER 1 — Backend Lead

## Files Owned

| File | What It Does | Most Important Function/Class |
|---|---|---|
| `backend/main.py` | App entry point — wires all routers, starts MongoDB + ChromaDB | `lifespan()` |
| `backend/core/database.py` | Async MongoDB connection via Motor | `connect_db()` |
| `backend/core/security.py` | JWT creation/verification, bcrypt hashing | `create_access_token()` |
| `backend/core/config.py` | Pydantic Settings — reads all env vars | `Settings` class |
| `backend/core/dependencies.py` | Shared `get_user()` auth dependency | `get_user()` |
| `backend/core/vector_store.py` | ChromaDB initialization with 2 collections | `init_vector_store()` |
| `backend/routers/auth.py` | Register, login, refresh, /me endpoints | `register()`, `login()` |
| `backend/routers/recipes.py` | 8-step generation pipeline, SSE streaming, cooked marking | `stream_generate()`, `mark_cooked()` |
| `backend/routers/pantry.py` | CRUD for pantry items, freshness calculation, optimize | `freshness()` |
| `backend/routers/health.py` | BMI stats, intake logging, today's nutrition | `log_intake()`, `get_today_intake()` |
| `backend/routers/meal_planner.py` | 7-day AI meal plan generation with diet enforcement | `smart_auto_fill()` |
| `backend/routers/leftovers.py` | Log, retrieve, and get AI suggestions for leftovers | `suggest_from_leftovers()` |
| `backend/routers/suggestions.py` | Daily personalized meal suggestions with RAG | `get_daily_suggestions()` |
| `backend/models/schemas.py` | Pydantic models for request/response validation | `UserRegister`, `RecipeGenerateRequest` |

---

## Key Files — Deep Explanation

### `backend/main.py`

**What is FastAPI lifespan?**

`lifespan` is a modern FastAPI pattern for startup/shutdown logic. It's an async context manager decorated with `@asynccontextmanager`. Everything **before** the `yield` runs at server startup; everything **after** the `yield` runs at shutdown.

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP: runs when server starts
    await connect_db()        # Connect to MongoDB
    init_vector_store()       # Initialize ChromaDB
    _init_models()            # Pre-warm Gemini models (no cold start)
    yield
    # SHUTDOWN: runs when server stops
    await disconnect_db()
```

**Why is CORS middleware added?**

CORS (Cross-Origin Resource Sharing) is a browser security policy that blocks JavaScript on `localhost:3000` from calling APIs on `localhost:8000` (a different port = different origin). The `CORSMiddleware` tells the browser: "these origins are allowed to make requests." Without it, every frontend request would be blocked.

```python
# CORS MUST be added FIRST before all routers
app.add_middleware(CORSMiddleware,
    allow_origins=["https://gen-ai-wellness-kitchen.vercel.app", 
                   "http://localhost:3000", "*"],
    allow_methods=["*"], allow_headers=["*"]
)
```

**What happens when the server starts?**
1. `dotenv` loads `.env` file → sets environment variables
2. `lifespan` starts → `connect_db()` connects to MongoDB at `localhost:27017`
3. `init_vector_store()` creates/opens ChromaDB at `./chroma_db`
4. `_init_models()` pre-loads Gemini model objects into memory
5. All 13 routers are registered with their URL prefixes
6. Server is ready to accept requests

---

### `backend/core/database.py`

**How does Motor (async MongoDB) work?**

Motor is the async Python driver for MongoDB. Unlike PyMongo (which blocks), Motor uses Python's `asyncio` event loop — while a DB query is waiting for network data, other requests can be processed. This is critical for FastAPI's async architecture.

```python
_db.client = motor.motor_asyncio.AsyncIOMotorClient(
    settings.mongodb_uri,
    maxPoolSize=50,              # Connection pool: up to 50 simultaneous connections
    serverSelectionTimeoutMS=3000  # Fail fast if MongoDB isn't reachable
)
```

**What is connection pooling?**

Instead of creating a new TCP connection for every database query (expensive, slow), Motor maintains a *pool* of pre-established connections. When a request needs MongoDB, it borrows a connection from the pool, uses it, and returns it. `maxPoolSize=50` means up to 50 concurrent DB operations can run simultaneously.

**What indexes are created and why?**

```python
await db.users.create_index("email", unique=True)     # Fast user lookup by email, prevents duplicates
await db.recipes.create_index("user_id")               # Fast: "give me all recipes for this user"
await db.recipes.create_index("created_at")            # Fast sort by newest
await db.pantry_items.create_index("user_id")          # Fast pantry lookup per user
await db.pantry_items.create_index([("user_id", 1), ("expiry_date", 1)])  # Compound: expiring items per user
await db.meal_plans.create_index([("user_id", 1), ("week_id", 1)])        # Fast weekly plan lookup
```

Without indexes, MongoDB does a full collection scan (O(n)) for every query. With indexes, lookups are O(log n). For example, finding "all pantry items for user X expiring in 5 days" would be instant.

---

### `backend/core/security.py`

**How does JWT work in this project?**

JWT (JSON Web Token) is a digitally signed string that encodes user identity. The format is: `header.payload.signature`. The server signs the token using a secret key — only the server can verify the signature. No database lookup is needed to authenticate a request.

**Flow:**
1. User logs in → server verifies password → server creates JWT with `{"sub": "user_mongo_id", "exp": timestamp}`
2. JWT is sent to the client (stored in localStorage)
3. Every API request includes `Authorization: Bearer <token>` header
4. Server decodes and verifies the JWT using `decode_access_token()` → gets user ID → fetches user from MongoDB

**Access Token vs. Refresh Token:**

| | Access Token | Refresh Token |
|---|---|---|
| Signed with | `JWT_SECRET` | `JWT_REFRESH_SECRET` |
| Expiry | 10080 minutes (7 days — set long for dev) | 30 days |
| Type marker | `"type": "access"` | `"type": "refresh"` |
| Used for | Every API call | Only to get a new access token |

**Algorithm:** HS256 (HMAC-SHA256) — symmetric signing (same key to sign and verify).

```python
def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    payload["type"] = "access"
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
```

**Why two different secrets?** If the refresh secret is compromised, attackers can only get new access tokens but can't forge access tokens directly (since those use a different secret). Defense-in-depth.

**Password hashing:**
```python
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
```
bcrypt automatically generates a random salt (makes rainbow table attacks impossible) and is computationally expensive by design (slows brute force attacks).

---

### `backend/routers/auth.py`

**POST /auth/register — Step by Step:**

1. Parse `UserRegister` body (Pydantic validates: email format, password min 8 chars, height 100-250cm, etc.)
2. Check if email already exists in MongoDB → return 400 if duplicate
3. Calculate BMI: `weight / (height_m²)` → categorize (underweight/normal/overweight/obese)
4. Calculate calorie targets via Mifflin-St Jeor BMR formula
5. Hash password with bcrypt
6. Build user document and insert into MongoDB
7. Create access token + refresh token (both signed JWTs with user's MongoDB `_id` as `sub`)
8. Return: `{ access_token, refresh_token, user }` — client is immediately logged in

**POST /auth/login — Step by Step:**

1. Parse `UserLogin` (email + password)
2. `find_one` in MongoDB by email — returns hashed password
3. `bcrypt.checkpw(plain, hashed)` — verifies password (never stored in plain text)
4. Update `last_active` timestamp in MongoDB
5. Create fresh access + refresh tokens
6. Return tokens + full user object

**What data is returned after login?**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "bearer",
    "user": {
      "id": "...",  "name": "...",  "email": "...",
      "bmi": 22.4,  "bmi_category": "normal",
      "daily_calorie_target": 2100,
      "macros": { "protein_g": 70, "carbs_g": 250, "fat_g": 65 },
      "meal_split": { "breakfast": 525, "lunch": 735, "dinner": 630, "snack": 210 }
    }
  }
}
```

---

### `backend/routers/recipes.py`

**The Full 8-Step Recipe Generation Pipeline:**

```
STEP 1: Authenticate user via JWT → get user document from MongoDB
STEP 2: Fetch pantry ingredients prioritized by expiry (leftover_optimizer.py)
STEP 3: Compute health profile (BMI, calorie target, macros) via health_engine.py
STEP 4: If image uploaded → Gemini Vision analyzes photo → extracts ingredient list
STEP 5: Run RAG retrieval → embed query → cosine similarity in ChromaDB → top-5 similar past recipes
STEP 6: Build structured prompt (system + user message) via prompt_builder.py
STEP 7: Send prompt to Gemini → receive JSON recipe (or stream token-by-token)
STEP 8: Run rule checker (allergen/dietary alerts) → save to MongoDB → return to client
```

**What is SSE Streaming and How is it Implemented?**

SSE (Server-Sent Events) is a one-directional HTTP connection where the server pushes data to the client as it becomes available — no polling needed. The browser keeps the HTTP connection open and receives `data: {...}\n\n` frames.

In this project, `GET /recipes/generate/stream` returns a `StreamingResponse`:

```python
async def event_gen():
    yield 'data: {"type":"step","message":"🥘 Checking your pantry..."}\n\n'
    pantry = await get_prioritized_ingredients(...)
    
    yield 'data: {"type":"step","message":"🔍 Finding similar recipes..."}\n\n'
    rag_docs = await retrieve(...)
    
    yield 'data: {"type":"step","message":"👨‍🍳 Crafting your recipe..."}\n\n'
    
    async for chunk in generate_recipe_stream(prompt):
        yield f"data: {json.dumps(chunk)}\n\n"  # Each Gemini token
        if chunk["type"] == "complete":
            # Save recipe to MongoDB
            ...

return StreamingResponse(event_gen(), media_type="text/event-stream")
```

**What is the /recipes/{id}/cooked endpoint?**

This is the most important endpoint for AI memory. When "I Cooked This" is clicked:
1. Mark recipe as `cooked: True` in MongoDB with timestamp
2. Call `index_recipe(recipe, user_id, cooked=True)` → converts recipe to embedding → stores in ChromaDB `user_history` collection
3. Log nutritional data to `food_intake` collection (calories, protein, carbs, fat)
4. Calculate remaining calories for the day
5. Return calories remaining so the frontend can update instantly

```python
# The magic line — this is what builds AI memory:
await index_recipe(recipe, str(user["_id"]), cooked=True)
```

---

### `backend/routers/pantry.py`

**CRUD Operations:**
- `GET /pantry/{user_id}` — list all pantry items sorted by expiry date
- `POST /pantry/item` — add new item (parses ISO expiry date strings safely)
- `PUT /pantry/item/{id}` — update item (recalculates freshness status)
- `DELETE /pantry/item/{id}` — delete item

**Freshness Calculation:**
```python
def freshness(expiry_date):
    days = (expiry_date - now).days
    if   days <  0: status = "expired"
    elif days <= 2: status = "expiring"
    elif days <= 7: status = "use_soon"
    else:           status = "fresh"
    return status, max(0, days)
```

**Why is `/expiring` route placed BEFORE `/{user_id}`?**

FastAPI's router matches routes in the order they are defined. If `/{user_id}` appeared first, then a request to `/expiring` would be captured by `/{user_id}` with `user_id = "expiring"` (a string, not an ObjectId), causing a MongoDB ObjectId parse error. The comment in the code explicitly notes this: `# IMPORTANT: /expiring MUST be before /{user_id}`.

**What is the optimize endpoint?**

`POST /pantry/optimize` finds the top 5 critical/soon-expiring items, queries ChromaDB for recipes that would use them, and returns suggestions. This helps users reduce food waste by using items before they expire.

---

### `backend/routers/health.py`

**How is BMI calculated?**
```
BMI = weight_kg / (height_m)²

Example: 70kg, 175cm
  height_m = 175 / 100 = 1.75
  BMI = 70 / (1.75 × 1.75) = 70 / 3.0625 = 22.9 → "normal"
```

Categories: < 18.5 underweight | 18.5-25 normal | 25-30 overweight | ≥ 30 obese

**What is the Mifflin-St Jeor Equation?**

The Mifflin-St Jeor equation estimates your Basal Metabolic Rate (BMR) — the calories your body burns at complete rest:

```
For MALE:   BMR = (10 × weight_kg) + (6.25 × height_cm) − (5 × age) + 5
For FEMALE: BMR = (10 × weight_kg) + (6.25 × height_cm) − (5 × age) − 161

Example: Male, 70kg, 175cm, 25 years
  BMR = (10×70) + (6.25×175) - (5×25) + 5
      = 700 + 1093.75 - 125 + 5 = 1673.75 kcal/day
```

**TDEE (Total Daily Energy Expenditure):**
```
TDEE = BMR × 1.4   (1.4 = light activity multiplier)

Example: 1673.75 × 1.4 = 2343 kcal/day
```

**Calorie target by health goal:**
```
weight_loss: TDEE - 500 = 1843 kcal  (500 kcal deficit → ~0.5kg/week loss)
muscle_gain: TDEE + 300 = 2643 kcal  (caloric surplus for muscle growth)
maintain:    TDEE        = 2343 kcal
gut_health:  TDEE        = 2343 kcal  (same calories, different food choices)
```

**Macro breakdown:**
```python
protein_g = round(weight_kg * 1.0)        # 1g protein per kg body weight
fat_g     = round((cals * 0.30) / 9)      # 30% calories from fat (9 kcal/g)
carbs_g   = round((cals - protein_g*4 - fat_g*9) / 4)  # Remainder as carbs (4 kcal/g)
```

**What is /intake/today?**

Returns today's food log from the `food_intake` collection — all meals logged today plus:
- `total_cal`: sum of all meal calories
- `target_cal`: user's daily calorie target
- `remaining`: how many more calories they can eat
- `percentage`: how full their "calorie budget" is (shown as a progress bar)

---

### `backend/routers/meal_planner.py`

**How does smart auto-fill work?**

`POST /meal-planner/auto-fill/smart` generates a 7-day meal plan using Gemini:
1. Compute health profile → get calorie target and macro breakdown
2. Determine diet type (vegan/vegetarian/non-vegetarian) — can be overridden per request
3. Get selected cuisines (from user profile or request body)
4. Build a prompt with strict dietary rules and calorie targets per day
5. Send to Gemini → returns 7-day JSON plan with breakfast/lunch/dinner/snack per day
6. Validate diet compliance — if any meal is missing `diet_type`, fill it in
7. Save plan to MongoDB with current week ID (e.g., `2026-W16`)

**How are cuisines enforced?**

The prompt explicitly includes: `Cuisines: north_indian, south_indian, bengali`. And for vegetarians: `STRICT RULE: You MUST NOT suggest any non-vegetarian dish.` This is injected into the Gemini prompt as a hard constraint. After generation, the backend also loops through every meal and verifies the `diet_type` field is set correctly.

---

### ChromaDB Integration (Member 1 + Member 3 overlap)

### `backend/core/vector_store.py`

**What is ChromaDB?**

ChromaDB is an open-source vector database. Unlike MongoDB (which stores documents and queries by field values), ChromaDB stores high-dimensional vectors (arrays of floats) and queries by *similarity* — "find me the 5 vectors most similar to this query vector."

**What is a PersistentClient?**

ChromaDB has two modes:
- **In-memory:** Fast but data lost on restart (used for testing)
- **PersistentClient:** Saves data to disk at `./chroma_db` — data survives server restarts

```python
_vs.client = chromadb.PersistentClient(path=settings.chroma_path)
```

This means user history accumulates over time and is never lost.

**Why two collections, why not one?**

| Collection | Name | Contains | Boost |
|---|---|---|---|
| Global pool | `recipes` | All recipes ever generated (all users) | 1.0x (normal score) |
| Personal history | `user_history` | Only recipes THIS user actually cooked | 1.4x (boosted score) |

The `user_history` collection gets a 1.4x score boost in retrieval because personal history is MORE relevant than global recipes. The 70/30 split means personal history has priority, but global recipes fill gaps when the user has cooked very few meals (new user cold start problem).

The metadata `{"hnsw:space": "cosine"}` tells ChromaDB to use cosine similarity as the distance metric.

---

# SECTION 3: MEMBER 2 — Frontend Lead

## Files Owned

| File | What It Does |
|---|---|
| `frontend/app/page.tsx` | Main dashboard with stats, food calendar, RAG suggestions |
| `frontend/app/generate/page.tsx` | Recipe generation with SSE streaming, image upload, "I Cooked This" |
| `frontend/app/pantry/page.tsx` | Pantry grid with freshness indicators, leftover section |
| `frontend/app/meal-planner/page.tsx` | 7-day meal plan display with diet filtering |
| `frontend/app/health/page.tsx` | Health stats, BMI display, nutrition tracking |
| `frontend/app/login/page.tsx` | Login form |
| `frontend/app/register/page.tsx` | Registration form with health profile setup |
| `frontend/app/recipes/page.tsx` | Recipe history grid with save/delete actions |
| `frontend/app/layout.tsx` | Root layout — toast notifications + AppShell wrapper |
| `frontend/lib/store.ts` | Zustand global auth state with localStorage persistence |
| `frontend/lib/api.ts` | Axios instance with JWT auto-attach and 401 auto-refresh |
| `frontend/lib/config.ts` | API URL config (localhost vs production) |
| `frontend/lib/images.ts` | Unsplash food image utility |
| `frontend/components/AppShell.tsx` | Sidebar + main content layout wrapper |
| `frontend/components/Sidebar.tsx` | Navigation sidebar with user info |
| `frontend/tailwind.config.ts` | Custom color palette (brand green, gold) |

---

## Key Files — Deep Explanation

### `frontend/app/page.tsx` (Dashboard)

**What data is fetched on load?**

All 7 API calls fire simultaneously using `Promise.allSettled` (parallel, not sequential):
```typescript
Promise.allSettled([
  recipesApi.list(user.id, 0, 6),                    // Last 6 recipes
  pantryApi.expiring(5),                              // Items expiring in 5 days
  pantryApi.list(user.id),                            // All pantry items
  fetch(`${API}/health/intake/today`),                // Today's calorie log
  fetch(`${API}/suggestions/daily`),                  // AI meal suggestions
  fetch(`${API}/leftovers/suggest`, {method:'POST'}), // Leftover suggestions
  fetch(`${API}/health/cooked-meals?days=7`),         // 7-day meal calendar
])
```

`Promise.allSettled` (vs `Promise.all`) means if one API fails, the rest still resolve — no partial page failure.

**How does the food calendar work?**

The dashboard pre-builds an empty 7-day calendar structure immediately on component mount (so the layout doesn't shift while loading):
```typescript
const [weekLog, setWeekLog] = useState(() => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - (6 - i))
    return { day, date, isToday: i === 6, calories: 0, meals: [] }
  })
})
```

When the API responds, `setWeekLog` fills each day with actual meal data from `food_intake`. Each day shows colored dots for B·L·D·S (breakfast/lunch/dinner/snack — green if logged, gray if not) and the total calorie count.

**How do RAG suggestions display?**

The `/suggestions/daily` endpoint returns two arrays:
- `suggestions`: 4 AI-generated personalized meals for today
- `history_suggestions`: 2 meals explicitly based on the user's RAG history

On the dashboard, RAG suggestions appear in a purple `"🧠 Based on Your History"` section with the badge `"RAG Powered"`. Clicking any suggestion navigates to `/generate?meal=DishName` which auto-triggers generation.

**What is useAuthStore?**

Zustand store accessed via hook. `useAuthStore((s) => s.user)` reads the current user from global state. If `user` is null (not logged in), the component returns `null` and the router redirects to `/login`.

---

### `frontend/app/generate/page.tsx`

**How does image upload work?**

Three input methods:
1. **File input** (hidden `<input type="file">`) — triggered by clicking the drop zone
2. **Drag and drop** — `onDrop` handler captures the dragged file
3. Both call `handleImageFile(file)` which validates type (must start with `image/`) and size (max 10MB)

The file is read as a base64 data URL using `FileReader.readAsDataURL()` and stored in `imagePreview` for display, and `imageFile` for sending to the backend.

When generating with an image, the base64 string is sent as `image_base64` in the POST body to `/recipes/generate`, which routes to Gemini Vision for ingredient detection.

**What is SSE Streaming on the Frontend?**

The generate page uses the native `fetch` API (not axios) to connect to the SSE endpoint:

```typescript
const response = await fetch(`${API_URL}/recipes/generate/stream?${params}`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }
})
const reader = response.body?.getReader()
const decoder = new TextDecoder()

while (true) {
  const { value, done } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const parsed = JSON.parse(line.replace('data: ', ''))
    
    if (parsed.type === 'step') setSteps(s => [...s, parsed.message])    // Progress steps
    if (parsed.type === 'token') setTokens(prev => prev + parsed.token)  // Live AI text
    if (parsed.type === 'complete') setRecipe(parsed.recipe)              // Final recipe
  }
}
```

The user sees: progress steps first (✨ Checking pantry... ✨ Finding recipes...), then raw JSON tokens streaming in real-time, then the formatted recipe card appears.

**How does "I Cooked This" button work?**

```typescript
const res = await fetch(`${API_URL}/recipes/${recipe.id}/cooked`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ meal_type: mealType })
})
const data = await res.json()
toast.success(`Logged! ${data.data.calories_remaining} kcal remaining today ✅`)
window.dispatchEvent(new Event('intake-updated'))  // Update calorie display elsewhere
```

This calls `POST /recipes/{id}/cooked` which: marks cooked in MongoDB + indexes in ChromaDB RAG + logs to food_intake. The response includes `calories_remaining` for immediate feedback.

---

### `frontend/app/pantry/page.tsx`

**How is the pantry grid rendered?**

Items are fetched from `GET /pantry/{userId}` (sorted by expiry) and displayed in a responsive grid. Each item card shows:
- Name + Hindi name
- Quantity + unit
- Freshness badge (color-coded: green=fresh, yellow=use_soon, red=expiring/expired)
- Days until expiry number

**How are leftovers shown separately?**

The pantry page queries `GET /leftovers/my` to get unused logged leftovers. These are displayed in a separate "Leftovers" section below the main pantry grid, allowing the user to track what was left over from previous meals.

**How does freshness status work?**

The backend calculates freshness in `pantry.py`:
```python
days = (expiry_date - now).days
if   days <  0: status = "expired"   # Red — already bad
elif days <= 2: status = "expiring"  # Red — use immediately  
elif days <= 7: status = "use_soon"  # Yellow — use within a week
else:           status = "fresh"     # Green — plenty of time
```

The frontend receives `freshness_status` and `days_until_expiry` pre-calculated from the backend.

---

### `frontend/app/meal-planner/page.tsx`

**How does the 7-day plan display?**

The component fetches `GET /meal-planner/{userId}` which returns the stored meal plan for the current ISO week. The plan is displayed as a 7-column grid (Mon-Sun), with each column showing 4 meal cards (breakfast, lunch, snack, dinner). Each card shows: dish name, cuisine, calories, prep time, and diet type indicator (veg/non-veg).

**How does diet type selection work?**

The meal planner UI has radio buttons/tabs for `vegetarian / non-vegetarian / vegan`. When the user clicks "Auto-Fill Smart Plan," the selected diet type is sent as `diet_type` in the request body:
```typescript
POST /meal-planner/auto-fill/smart  
{ diet_type: "vegetarian", cuisines: ["north_indian", "south_indian"] }
```

The backend uses this to impose strict prompt constraints and also adds the `diet_type` label to every generated meal.

**How does cuisine filtering work?**

The user can multi-select cuisines (e.g., North Indian, Bengali, Continental). These are sent to the backend as `cuisines: ["north_indian", "bengali"]` and injected into the Gemini prompt: `Cuisines: north_indian, bengali`. The AI is instructed to vary cuisines throughout the week.

---

### `frontend/lib/store.ts`

**What is Zustand?**

Zustand is a lightweight state management library for React. Unlike Redux (which requires reducers, actions, dispatches), Zustand works like this:

```typescript
const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken)
        set({ user, accessToken, refreshToken })
      },
      logout: () => {
        localStorage.removeItem('access_token')
        set({ user: null, accessToken: null })
      }
    }),
    { name: 'wk-auth' }  // localStorage key
  )
)
```

**What data is stored globally?**
- `user` — full user object (id, name, email, bmi, calorie_target, macros, etc.)
- `accessToken` — JWT access token
- `refreshToken` — JWT refresh token

**How does session persist across page refreshes?**

The `persist` middleware from `zustand/middleware` serializes the store state to `localStorage` under the key `'wk-auth'`. When the page loads, Zustand re-reads from localStorage and rehydrates the store. The `partialize` function limits what gets persisted (only `user`, `accessToken`, `refreshToken` — not ephemeral UI state).

---

### `frontend/lib/api.ts`

**How is axios configured?**

```typescript
const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 60000  // 60 seconds (Gemini generation can take ~10-15s)
})
```

**How is JWT automatically attached to requests?**

A request interceptor runs before every API call:
```typescript
API.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})
```

Every single axios request automatically has `Authorization: Bearer <token>` attached, so individual call sites don't need to handle this.

**What happens on 401 error?**

A response interceptor handles expired tokens:
```typescript
API.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401) {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        // Try to get a new access token using refresh token
        const { data } = await axios.post('/auth/refresh', { refresh_token: refresh })
        localStorage.setItem('access_token', data.data.access_token)
        // Retry the original failed request with new token
        err.config.headers.Authorization = `Bearer ${data.data.access_token}`
        return API(err.config)  // Retry!
      }
      // Refresh also failed → logout
      localStorage.clear()
      window.location.href = '/login'
    }
  }
)
```

This means tokens **silently refresh** without the user being logged out (transparent to the user).

---

### `frontend/lib/config.ts`

```typescript
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
```

**Why is API_URL needed?**

Next.js apps run in two environments: the browser (client) and the Node.js server (for SSR). Only environment variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. `NEXT_PUBLIC_API_URL` lets you set different API URLs per environment without changing code.

**How does it work locally vs production?**

| Environment | NEXT_PUBLIC_API_URL value | Result |
|---|---|---|
| Local dev | `http://localhost:8000` (from `.env.local`) | Calls local FastAPI |
| Vercel production | `https://wellness-kitchen.railway.app` (set in Vercel dashboard) | Calls Railway-hosted API |

The fallback `|| 'http://localhost:8000'` ensures it works even if the env var isn't set during local development.

---

## SSE Streaming — Complete Flow

**What is Server-Sent Events?**

SSE is a W3C standard where the server keeps an HTTP response open and pushes `data: {...}\n\n` frames whenever it has new data. The client uses the native `EventSource` API or `fetch` with a stream reader.

**How does it differ from WebSockets?**

| | SSE | WebSockets |
|---|---|---|
| Direction | Server → Client only | Bidirectional |
| Protocol | HTTP/1.1 | WS:// upgrade |
| Reconnect | Automatic | Manual |
| Use case | Live updates, streaming | Chat, games |

SSE is simpler and more appropriate for recipe streaming (one direction: server pushes tokens to client).

**Exact Flow: Button Click → Recipe on Screen**

```
1. User clicks "Generate Recipe"
   → frontend: calls generate(), sets loading=true, clears recipe/steps/tokens state

2. Frontend opens SSE connection:
   GET /recipes/generate/stream?meal_type=lunch&cuisine=any&ingredients=chicken
   Authorization: Bearer eyJ...

3. Backend (async generator starts):
   a. Authenticate user from JWT header
   b. Yield: {"type":"step","message":"🥘 Checking your pantry..."}
   c. Fetch pantry from MongoDB (prioritized by expiry)
   d. Yield: {"type":"step","message":"💪 Analyzing health profile..."}
   e. Compute BMI, calorie target, macros
   f. Yield: {"type":"step","message":"🔍 Finding similar recipes..."}
   g. Embed query → ChromaDB cosine similarity → top-5 past recipes
   h. Yield: {"type":"step","message":"👨‍🍳 Crafting your recipe..."}
   i. Build prompt (system + user message with all context)
   j. Start Gemini streaming:
      for each token from Gemini:
        Yield: {"type":"token","token":"{\"title\":"}
        Yield: {"type":"token","token":"\"Chicken"}
        ...
   k. Full JSON accumulated → parse → Yield: {"type":"complete","recipe":{...}}
   l. Yield: {"type":"warnings","warnings":[...]}

4. Frontend receives and handles each SSE frame:
   "step" → append to steps[] array → show as progress
   "token" → append to tokens string → show live stream panel
   "complete" → setRecipe(parsed.recipe) → show recipe card
   "warnings" → could show allergen alerts

5. User sees:
   ✨ Checking your pantry...
   ✨ Analyzing health profile...
   ✨ Finding similar recipes...
   ✨ Crafting your recipe...
   [Live AI stream: {"title": "Chicken Tu...]  ← real-time tokens
   [Beautiful recipe card appears]
```

---

## State Management — Full Explanation

**What is Zustand and why use it?**

Zustand is a minimal React state management library. The alternatives are:
- **useState** — local only, can't share between pages
- **Redux** — powerful but complex boilerplate
- **Zustand** — simple, works across pages, TypeScript-friendly, tiny bundle size

**What data is stored globally?**
- `user` object (all health data, preferences)
- `accessToken` and `refreshToken` (JWTs for API calls)

**How does session persist across page refreshes?**

The `persist` middleware saves the store to `localStorage['wk-auth']` on every state change. On page load, Zustand reads from localStorage and rehydrates the store. So if you close the browser and reopen, you're still logged in (until the tokens expire).

---

# SECTION 4: MEMBER 3 — AI/Researcher

## Files Owned

| File | What It Does |
|---|---|
| `backend/services/gemini_service.py` | Gemini API calls: text generation, streaming, vision analysis |
| `backend/services/rag_service.py` | RAG pipeline: embedding, indexing, retrieval, context formatting |
| `backend/services/prompt_builder.py` | Constructs structured system+user prompts with all context |
| `backend/services/health_engine.py` | BMI, Mifflin-St Jeor BMR, TDEE, macro calculations |
| `backend/services/rule_checker.py` | Allergen detection, dietary compliance, calorie warnings |
| `backend/services/leftover_optimizer.py` | Expiry-based ingredient scoring and prioritization |

---

## Key Files — Deep Explanation

### `backend/services/gemini_service.py`

**How is the Gemini API called?**

The service uses `google-generativeai` Python SDK. It maintains a model cache to avoid re-initializing:
```python
_model_cache: dict = {}

def _get_model(name: str):
    if name not in _model_cache:
        genai.configure(api_key=settings.gemini_api_key)
        _model_cache[name] = genai.GenerativeModel(name)
    return _model_cache[name]
```

**Model fallback chain:**
```python
MODEL_CHAIN = [
    "gemini-flash-lite-latest",  # Fastest (~2-5s), tries first
    "gemini-2.5-flash",          # Fallback if lite is rate-limited
    "gemini-flash-latest",       # Last resort
]
```

If any model returns a 429 (rate limit) error, the service waits 0.5s and tries the next model. For other errors, it fails immediately (non-quota errors are bugs, not transient).

**Streaming vs Non-Streaming Generation:**

| | Non-Streaming (`generate_recipe`) | Streaming (`generate_recipe_stream`) |
|---|---|---|
| Call | `generate_content_async(prompt)` | `generate_content_async(prompt, stream=True)` |
| Returns | Complete text at once | Async iterator of chunks |
| Use case | Meal plans, substitutions | Recipe generation (live feedback) |
| Token budget | Varies by `token_budget` param | Fixed at 2200 tokens |

```python
# Streaming
resp = await model.generate_content_async(prompt, config, stream=True)
async for chunk in resp:
    if chunk.text:
        full_text += chunk.text
        yield {"type": "token", "token": chunk.text}
yield {"type": "complete", "recipe": _clean_json(full_text)}
```

**How does image analysis work with Gemini Vision?**

The image is passed as `inline_data` alongside a text prompt:
```python
image_part = {
    "inline_data": {
        "mime_type": "image/jpeg",
        "data": raw_base64_string
    }
}
text_part = "List ONLY the raw food ingredients you can clearly see..."

model.generate_content([image_part, text_part])
```

Gemini Vision processes both simultaneously and returns a JSON array like `["carrot", "potato", "onion"]`. These detected ingredients then replace whatever the user typed, overriding dietary preferences for that request.

**Why gemini-1.5-flash?**

Specifically for vision analysis, `gemini-1.5-flash` is used because:
- It supports multimodal input (image + text)
- It's fast (flash tier)
- It's cheaper than `gemini-1.5-pro`
- The task (ingredient detection) doesn't need reasoning depth

The main generation pipeline uses `gemini-flash-lite-latest` (newer and faster) with fallback to `gemini-2.5-flash`.

**Token budgets:**
```python
TOKEN_BUDGETS = {
    "default":    2200,  # Recipe generation — enough for full recipe
    "cook_steps": 2200,  # Step-by-step cooking guide
    "meal_plan":  3500,  # 7-day plan — needs more tokens for 4×7=28 meals
    "quick":       700,  # Fast substitutions, short answers
}
```

**Temperature and parameters:**
```python
genai.GenerationConfig(
    temperature=0.4,   # Low randomness for consistent JSON output
    top_p=0.85,        # Sample from top 85% of probable tokens
    max_output_tokens=max_tokens,
)
```

Low temperature (0.4) is crucial because we need valid JSON output. High temperature would generate creative but structurally invalid JSON.

---

### `backend/services/rag_service.py`

**What is RAG (Retrieval Augmented Generation)?**

RAG is a technique that enhances AI generation by first retrieving relevant information from a knowledge base. The AI doesn't need to "remember" everything — it retrieves fresh context for each query.

```
Traditional LLM:    User → Prompt → LLM → Output (stateless, no memory)
RAG-enhanced LLM:   User → Query → Vector DB → Retrieved Docs → Prompt + Context → LLM → Output
```

**What embedding model is used?**

Model: `all-MiniLM-L6-v2` from the `sentence-transformers` library.

This model:
- Creates **384-dimensional vectors** (arrays of 384 floats)
- Runs **locally** on the server (no API cost, no network latency)
- Is **fast** (~5-10ms per embedding on CPU)
- Captures **semantic meaning** (not just word matching)

```python
_model = SentenceTransformer("all-MiniLM-L6-v2")
embedding = _model.encode("chicken biryani north indian spicy").tolist()
# Returns: [0.023, -0.178, 0.456, ...] (384 floats)
```

**What are vector embeddings and why use them?**

A vector embedding is a numerical representation of text in a high-dimensional space where *semantically similar texts are geometrically close*. 

Example: "chicken curry" and "murgh masala" might produce vectors that are very close in 384D space, even though they share no words. "chocolate cake" would produce a vector far away from both.

Traditional keyword search fails here: "garlic chicken" ≠ "poulet à l'ail" (French). Vector search: both would be very close in embedding space.

**How is a recipe converted to an embedding? (recipe_to_text logic)**

```python
def embed_recipe(recipe):
    title = recipe.get("title", "")
    ings = " ".join([
        i.get("name", "") if isinstance(i, dict) else str(i)
        for i in recipe.get("ingredients", [])
    ])
    text = (
        f"{title} {ings} "
        f"{recipe.get('cuisine', '')} "
        f"{recipe.get('meal_type', '')} "
        f"{' '.join(recipe.get('health_tags', []))}"
    )
    return SentenceTransformer.encode(text)
```

Example text generated: `"Chicken Biryani chicken basmati rice onion tomato north_indian lunch high-protein"`  
This becomes a 384-dim vector capturing: protein-rich lunch, north Indian, rice-based, chicken.

**How does the retrieve() function work?**

```python
async def retrieve(query, user_id, top_k=5, dietary_filter=None):
    q_emb = embed(query)  # Convert query to vector
    
    # 1. Search user's personal history
    r = user_history_collection.query(
        query_embeddings=[q_emb],
        n_results=5,
        where={"user_id": {"$eq": user_id}}  # Only this user's cooked meals
    )
    for result in r:
        score = (1 - distance) * 1.4  # 1.4x BOOST for personal history
        results.append({score, metadata, source="history"})
    
    # 2. Search global recipe pool
    r = recipes_collection.query(query_embeddings=[q_emb], n_results=8)
    for result in r:
        score = 1 - distance  # Normal score (no boost)
        results.append({score, metadata, source="global"})
    
    # Sort by score descending, deduplicate by title
    return sorted(results, by=score)[:top_k]
```

**What is cosine similarity?**

Cosine similarity measures the angle between two vectors. It ranges from -1 (opposite) to 1 (identical). Two vectors pointing in the same direction are "similar" regardless of their magnitude.

Simple example:
```
"chicken rice"   → vector A = [0.8, 0.2, 0.1]
"biryani"        → vector B = [0.7, 0.3, 0.1]  ← similar direction
"chocolate cake" → vector C = [0.1, 0.9, 0.8]  ← different direction

cosine_sim(A, B) = 0.98  ← very similar
cosine_sim(A, C) = 0.15  ← very different
```

In ChromaDB, `distance = 1 - cosine_similarity`. So `score = 1 - distance = cosine_similarity`.

**The 1.4x Boost and 70/30 Split:**

Personal history recipes get multiplied by 1.4:
```python
score = (1 - distance) * 1.4  # User history gets 40% extra relevance
```

If a global recipe scores 0.8 and a personal history recipe scores 0.7:
- Global: 0.8 (raw)
- Personal: 0.7 × 1.4 = 0.98 (boosted → ranked higher)

This ensures personal preferences always dominate over generic global suggestions — the AI learns YOUR taste, not an average user's taste.

**What is the dietary filter and how does it work?**

```python
def _build_diet_exclusion(dietary_filter: str) -> set:
    if dietary_filter in ("veg", "vegetarian"):
        return {"non-veg"}      # Exclude meat dishes
    if dietary_filter == "vegan":
        return {"non-veg", "veg"}  # Exclude meat AND dairy
    return set()  # No filter
```

During retrieval, any document whose `diet_type` metadata is in the exclusion set is skipped before adding to results. This prevents recommending chicken biryani to a vegetarian user.

**When is index_recipe called?**

```python
# ONLY when user explicitly marks a recipe as cooked:
@router.post("/{id}/cooked")
async def mark_cooked(id, user, ...):
    await index_recipe(recipe, user_id, cooked=True)  # ← Only here!
```

**NOT on every generation — why?**
- RAG is meant to reflect what the user ACTUALLY ATE, not just what was generated
- If every generation was indexed, the user might generate 50 recipes but cook only 5. The RAG would be polluted with 45 "hypothetical" preferences.
- By indexing ONLY on "I Cooked This," the RAG reflects genuine food choices.

**How does RAG context reach Gemini?**

```python
rag_docs = await retrieve(query, user_id, top_k=5)
rag_ctx = format_context(rag_docs)
# format_context() returns:
# "User's previously cooked recipes:
#  1. Chicken Biryani | Cuisine: north_indian | Tags: high-protein,... | Source: history
#  2. Dal Makhani | Cuisine: north_indian | Tags: high-fiber,... | Source: global"

prompt = build_recipe_prompt(ingredients, health, rag_ctx, ...)
# This string is injected into the prompt user message:
# "AI Memory context (user past recipes): {rag_ctx}"
```

---

### `backend/services/prompt_builder.py`

**What is prompt engineering?**

Prompt engineering is the practice of carefully designing the text sent to an AI model to maximize the quality, consistency, and safety of its output. For structured data (like JSON recipes), prompt engineering is critical.

**The System Prompt (line by line):**

```python
system = """You are 'Wellness AI', an expert health chef and nutritionist.
Create delicious recipes that match the user's health goals and use their requested ingredients.
CRITICAL RULES:
1. If ingredients are provided, your recipe MUST use those exact ingredients as primary components.
2. If ingredients were DETECTED FROM PHOTO, use ONLY what was detected — do NOT add proteins 
   (chicken, paneer, egg, fish) unless they appear in the detected list.
3. If user requests chicken/fish/beef — use it exactly (do NOT substitute).
4. NEVER generate a recipe that contradicts the ingredient list provided.
Output ONLY valid JSON. No text outside JSON."""
```

- **Rule 1:** Prevents generic recipes that ignore user input
- **Rule 2:** Critical for image mode — if user uploads a vegetable photo, don't hallucinate chicken
- **Rule 3:** User autonomy — if someone explicitly requests a non-veg dish, honor it
- **Rule 4:** Consistency enforcement
- **Output ONLY JSON:** Prevents the model from adding explanatory text that breaks JSON parsing

**How does user health data get into the prompt?**

```python
user_msg = f"""
User: BMI {health['bmi']} ({health['bmi_category']}), 
Goal: {user_prefs.get('health_goal','maintain')}, 
{meal_type} budget: {meal_budget} kcal        ← e.g., "lunch budget: 735 kcal"
Allergies: {', '.join(user_prefs.get('allergies',[])) or 'none'}
Dietary preferences: {', '.join(user_prefs.get('dietary_preferences',[])) or 'none'}
"""
```

The calorie budget per meal is pre-calculated:
- Breakfast: 25% of daily target
- Lunch: 35% of daily target  
- Dinner: 30% of daily target
- Snack: 10% of daily target

**How does RAG context get into the prompt?**

```python
AI Memory context (user past recipes): {rag_context[:600] if rag_context else 'none'}
```

The first 600 characters of the RAG context are injected directly. This tells Gemini what this specific user has cooked before, enabling personalization. The 600-char limit prevents the prompt from getting too long.

**How does expiring pantry data get into the prompt?**

```python
critical = [x["name"] for x in pantry.get("critical", [])]  # Expiring today/tomorrow
soon     = [x["name"] for x in pantry.get("soon", [])]       # Expiring within 5 days

user_msg += f"\nExpiring pantry items to prioritize: {', '.join(critical + soon) or 'none'}"
```

This tells Gemini: "The user has tomatoes expiring today — try to use them in this recipe."

**Why does image upload clear dietary preferences?**

```python
if image_detected or explicit_nonveg:
    user_prefs = {
        "dietary_preferences": [],  # CLEARED
        "allergies": user.get("allergies", []),  # Allergies still respected
        "health_goal": user.get("health_goal", "maintain")
    }
```

If a user uploads a photo of chicken legs, they're clearly intending to make a chicken dish — even if their profile says vegetarian. Clearing dietary preferences allows Gemini to generate a chicken recipe without being blocked by the vegetarian constraint. Allergies, however, are still respected (safety > preference).

The override message in the prompt reinforces this:
```python
override_msg = "IMPORTANT: User requested specific ingredients or uploaded an image. 
Generate a recipe using EXACTLY these ingredients. Ignore normal dietary profile restrictions."
```

---

### `backend/services/health_engine.py`

**BMI Formula with Example:**
```
BMI = weight_kg / (height_m)²

Person: 80kg, 180cm
  height_m = 1.80
  BMI = 80 / (1.80 × 1.80) = 80 / 3.24 = 24.7 → "normal"
```

**Mifflin-St Jeor BMR with Example Numbers:**

```
Male formula:   BMR = 10W + 6.25H - 5A + 5
Female formula: BMR = 10W + 6.25H - 5A - 161

Example MALE: 80kg, 180cm, 30 years old
  BMR = (10×80) + (6.25×180) - (5×30) + 5
      = 800 + 1125 - 150 + 5
      = 1780 kcal/day (resting metabolic rate)

Example FEMALE: 60kg, 165cm, 28 years old
  BMR = (10×60) + (6.25×165) - (5×28) - 161
      = 600 + 1031.25 - 140 - 161
      = 1330.25 kcal/day
```

**TDEE from BMR:**
```
TDEE = BMR × 1.4   (sedentary-to-lightly-active multiplier)

Male example:   1780 × 1.4 = 2492 kcal/day
Female example: 1330 × 1.4 = 1862 kcal/day
```

**Calorie target by goal:**
```python
cals = {
    "weight_loss": tdee - 500,  # Male: 1992 kcal/day
    "muscle_gain": tdee + 300,  # Male: 2792 kcal/day
    "maintain":    tdee,        # Male: 2492 kcal/day
    "gut_health":  tdee         # Male: 2492 kcal/day (same calories)
}.get(goal, tdee)
```

**Macro targets (Male example at "maintain" 2492 kcal):**
```python
protein_g = round(weight_kg * 1.0)    = 80g         (80kg → 80g protein)
fat_g     = round((2492 * 0.30) / 9)  = 83g         (30% calories from fat)
carbs_g   = round((2492 - 80*4 - 83*9) / 4)
          = round((2492 - 320 - 747) / 4)
          = round(1425 / 4)            = 356g        (remainder as carbs)
```

---

### `backend/services/rule_checker.py`

**What rules are checked?**

Three types of rules:

1. **Allergen check** — user's allergens vs. ingredient list
2. **Dietary check** — vegetarian/vegan user got non-veg item (they didn't request)
3. **High-GI check** — diabetic-friendly users getting high-glycemic ingredients

**Allergen detection logic:**
```python
ALLERGEN_MAP = {
    "dairy":     ["milk","cream","butter","ghee","paneer","curd","yogurt","cheese"],
    "gluten":    ["wheat","maida","atta","bread","naan","roti","paratha"],
    "peanuts":   ["peanut","groundnut","mungfali"],
    "shellfish": ["prawn","shrimp","crab","lobster"],
    "eggs":      ["egg","anda"],
    "soy":       ["soy","tofu","soya"]
}

for allergy in user.allergies:
    triggers = ALLERGEN_MAP.get(allergy, [allergy])
    found = [i for i in ing_names if any(t in i for t in triggers)]
    if found:
        warning("⚠️ Contains {allergy}: {found}", severity="high")
```

Mapping from allergy category → actual ingredient keywords makes the check work even when ingredients are written differently (e.g., "milk powder" triggers "dairy" allergy).

**Vegetarian/vegan check logic:**
```python
NON_VEG = ["chicken","mutton","fish","egg","prawn","beef","pork","meat"]

if "vegetarian" in prefs:
    explicitly_requested = [i.lower() for i in recipe.get("explicitly_requested", [])]
    found = [i for i in ing_names 
             if any(n in i for n in NON_VEG)
             and not any(r in i for r in explicitly_requested)]
    if found: warning(...)
```

Critical logic: `not any(r in i for r in explicitly_requested)` — if the user TYPED "chicken" themselves, the warning is suppressed. This prevents annoying false-positive warnings when users intentionally request non-veg food.

**What happens when a rule is violated?**

Warnings are returned alongside the recipe — **the recipe is NOT blocked**. This is a deliberate design choice:
- Allergen warnings are shown with severity "high" (red)
- Dietary warnings with severity "medium" (yellow)
- The user can still view and cook the recipe

```python
return {
    "warnings": warnings,
    "is_safe": len(high_severity_warnings) == 0,
    "warning_count": len(warnings)
}
```

Rationale: The AI might be wrong sometimes. Blocking the recipe would be frustrating. Better to warn and let the user decide.

---

### `backend/services/leftover_optimizer.py`

**How are items scored by expiry date?**

```python
days = (expiry - now).days
if   days <  0: score = 0    # Already expired — don't use (but don't crash)
elif days == 0: score = 10   # "USE TODAY" — maximum urgency
elif days <= 2: score = 9    # Use in next 2 days
elif days <= 5: score = 7    # Use within 5 days
elif days <= 10: score = 4   # Use within 10 days
else:            score = 1   # Fresh — no urgency
```

**Score = 10 means "use today."** Items with `score >= 9` are marked as `critical`. Items with `4 <= score < 9` are marked as `soon`. The `critical` list is what gets included in "expiry_hint" messages like "Use tomatoes, spinach today — expiring!"

**How does this influence recipe generation?**

```python
# In prompt_builder.py:
critical = [x["name"] for x in pantry.get("critical", [])]
soon     = [x["name"] for x in pantry.get("soon", [])]

"Expiring pantry items to prioritize: {', '.join(critical + soon)}"
```

Gemini is instructed to BUILD THE RECIPE AROUND these expiring items. If you have spinach expiring today, Gemini is told to make a spinach-forward recipe, ensuring zero food waste.

---

# SECTION 5: CHROMADB + RAG DEEP DIVE

## The Core Problem RAG Solves

> *"Without RAG, every generation is stateless — the AI has no memory of what the user likes."*

Every time you call Gemini without RAG, it treats you as a completely new user. It doesn't know you hate coriander, that you always cook high-protein lunches, that you've made chicken biryani 10 times, or that you're trying to lose weight. RAG fixes this by giving the AI a "memory" derived from YOUR actual behavior.

---

## Complete Architecture Diagram

```
User cooks a meal
        │
        ▼
User clicks "I Cooked This"
        │
        ▼
POST /recipes/{id}/cooked
        │
        ▼
Recipe text assembled:
  "{title} {ingredients} {cuisine} {meal_type} {health_tags}"
        │
        ▼
sentence-transformers all-MiniLM-L6-v2 model
        │
        ▼
384-dimensional float vector created
  [0.023, -0.178, 0.456, 0.091, ..., -0.234]  (384 values)
        │
        ▼
Stored in ChromaDB  user_history  collection
  with metadata: { user_id, title, cuisine, meal_type, diet_type }
        │
        ═══════════════════════════════════════════════════
        │ (Next time user generates a recipe)
        ▼
User types: "I want chicken for lunch"
        │
        ▼
Query text: "chicken any lunch" → embed → 384-dim vector
        │
        ▼
ChromaDB cosine similarity search:
  → user_history: top 5 matches (BOOSTED ×1.4)
  → recipes (global): top 8 matches (normal score)
  → Deduplicate → sort by final score → top 5 returned
        │
        ▼
format_context() converts to readable text:
  "User's previously cooked recipes:
   1. Chicken Biryani | north_indian | high-protein | history
   2. Butter Chicken | mughlai | creamy | history
   ..."
        │
        ▼
Injected into Gemini prompt:
  "AI Memory context (user past recipes): {context}"
        │
        ▼
Gemini generates personalized recipe
  knowing: user likes north Indian, chicken, high-protein
        │
        ▼
Recipe appears — tailored to THIS user's taste
```

---

## Why Two ChromaDB Collections?

| | `recipes` collection | `user_history` collection |
|---|---|---|
| **What it stores** | All recipes ever generated (all users) | Only recipes THIS user explicitly cooked |
| **Populated by** | Every cooked recipe + seeded data | Only on "I Cooked This" click |
| **Score multiplier** | 1.0x (baseline) | 1.4x (boosted — 40% preference bonus) |
| **Purpose** | Provide variety and fallback when history is sparse | Personalization — "what I actually like" |
| **Cold start** | Large pool immediately available | Empty for new users (fills over time) |

**The 70/30 split in practice:**
When retrieving top-5 results, up to 5 come from history and up to 8 from global. After deduplication and sorting by final score, the personal history recipes (×1.4) usually win. For a new user with no history, global recipes fill all 5 slots.

---

## Cosine Similarity — Simple Explanation

Imagine you're comparing recipe descriptions in a 2D space for simplicity:
- Dimension 1 = "spiciness"
- Dimension 2 = "protein level"

```
                   High protein
                        │
Chicken Biryani ●       │       ● Grilled Chicken Salad
                        │
━━━━━━━━━━━━━━━━━━━━━━━━╋━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Mild                │                    Spicy
                        │
    ● Kheer             │       ● Paneer Vindaloo
                Low protein
```

Cosine similarity measures the **angle** between vectors (direction, not magnitude). "Chicken Biryani" and "Chicken Tikka Masala" would point in similar directions (high protein, spicy) → high cosine similarity. "Chicken Biryani" and "Kheer" point in very different directions → low cosine similarity.

In 384 dimensions, this same principle applies — semantically similar foods cluster together in hyperspace.

---

## What is sentence-transformers?

`sentence-transformers` is a Python library that wraps pre-trained transformer models to produce sentence-level embeddings.

**Model: all-MiniLM-L6-v2**
- `MiniLM`: Distilled, smaller version of BERT
- `L6`: 6 transformer layers (fast)
- `v2`: Second version (improved)
- Output: **384-dimensional** vector
- Inference speed: ~5-10ms per sentence on CPU
- Model size: ~91MB

**Why this model specifically?**
- Excellent performance/speed balance (state of the art for its size)
- Free — runs locally, no API calls, no cost per embedding
- Optimized for semantic textual similarity (exactly what we need)
- Well-documented and production-proven

---

# SECTION 6: DEPLOYMENT ARCHITECTURE

## Local Development

| Component | Service | Port/Location |
|---|---|---|
| Frontend | Next.js dev server (`npm run dev`) | `http://localhost:3000` |
| Backend | FastAPI (`uvicorn main:app --reload`) | `http://localhost:8000` |
| Database | MongoDB community (`mongod`) | `localhost:27017` |
| Vector DB | ChromaDB PersistentClient | `./backend/chroma_db/` (local filesystem) |
| AI | Google Gemini API | Cloud (via GEMINI_API_KEY) |
| Embeddings | sentence-transformers loaded in Python | Local RAM/CPU |

## Production Deployment

| Component | Service | Notes |
|---|---|---|
| Frontend | **Vercel** | Auto-deploys from GitHub main branch |
| Backend | **Railway** | Python/FastAPI container, auto-deploys |
| Database | **MongoDB Atlas** | Cloud managed, free M0 tier |
| Vector DB | **ChromaDB** | Persistent on Railway filesystem (within container) |
| AI | Google Gemini API | Same cloud API, requires GEMINI_API_KEY in Railway env |

---

## Environment Variables — Complete List

### Backend `.env`

| Variable | Value | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `AIzaSy...` | Authenticates calls to Google Gemini API |
| `GEMINI_MODEL` | `gemini-flash-lite-latest` | Default model (can override) |
| `MONGODB_URI` | `mongodb://localhost:27017/...` | MongoDB connection string |
| `DB_NAME` | `wellness_kitchen` | MongoDB database name |
| `JWT_SECRET` | `wellness-kitchen-jwt-secret-...` | Signs access tokens (min 32 chars for HS256 security) |
| `JWT_REFRESH_SECRET` | `wellness-refresh-secret-...` | Signs refresh tokens (separate secret = defense in depth) |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | sentence-transformers model name |
| `CHROMA_PATH` | `./chroma_db` | Where ChromaDB stores its files |

### Frontend `.env.local`

| Variable | Value | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL (exposed to browser) |
| `NEXTAUTH_URL` | `http://localhost:3000` | NextAuth callback URL (if used) |
| `NEXTAUTH_SECRET` | `wellness-kitchen-secret` | NextAuth session encryption |

---

## CORS Explanation

**What is CORS?**

When a browser runs JavaScript on `https://gen-ai-wellness-kitchen.vercel.app` and tries to call `https://wellness-kitchen.railway.app/recipes/generate`, the browser checks if the server allows this cross-origin request. This is a browser security feature (not a server feature — the server always receives the request, but the browser may block the response).

**Why is it needed here?**

The frontend and backend are on different domains:
- Frontend: `vercel.app`
- Backend: `railway.app`

Without CORS headers, every API call would be silently blocked by the browser with "CORS policy error."

**Configuration in this project:**
```python
app.add_middleware(CORSMiddleware,
    allow_origins=[
        "https://gen-ai-wellness-kitchen.vercel.app",  # Production frontend
        "https://*.vercel.app",                         # Preview deployments
        "http://localhost:3000",                        # Local development
        "*"                                             # Permissive fallback
    ],
    allow_credentials=False,  # Can't use credentials with wildcard origins
    allow_methods=["*"],       # GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],       # Authorization, Content-Type, etc.
)
```

**The localhost vs production URL issue:**

During development, the frontend at `localhost:3000` calls `localhost:8000`. In production, it should call the Railway URL. This is solved by `NEXT_PUBLIC_API_URL` — set `localhost:8000` locally and the Railway URL in Vercel's environment variables dashboard. The code auto-picks the right one: `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'`.

---

# SECTION 7: VIVA QUESTIONS & ANSWERS

---

**Q1: What is the base paper you extended?**

> We extended the concepts from **LLaVA-Chef**, a research paper that demonstrated using Large Vision-Language Models to analyze food images and generate recipes from visual input. LLaVA-Chef showed that multimodal AI — combining image analysis with text generation — is viable for recipe generation. Our project took this core idea and built a comprehensive, production-grade application around it, adding real-time personalization through RAG, health-aware recipe targeting, multi-user authentication, food waste reduction features, and real-time streaming — none of which existed in the original paper.

---

**Q2: What are the limitations of LLaVA-Chef that you addressed?**

> LLaVA-Chef had several limitations: (1) It was a research prototype with no real user system — no authentication, no personal data, no persistence. We added JWT auth and MongoDB for multi-user support. (2) It had no memory — every generation was stateless. We addressed this with ChromaDB RAG that learns from each user's cooking history. (3) It didn't consider health factors — no BMI, no calorie targets, no dietary restrictions. We added full health profiling using Mifflin-St Jeor equations. (4) It had no food waste reduction features. We added a leftover optimizer and expiry-aware pantry system. (5) Its outputs were not streamed — users saw nothing until generation was complete. We added SSE streaming for real-time feedback.

---

**Q3: Explain RAG in simple terms.**

> Imagine you're a chef who's been cooking for a family for 10 years. Over time, you've noticed they love spicy north Indian food, always want high-protein lunches, and have a dairy allergy. When they ask for a new recipe, you don't start from scratch — you use your 10 years of kitchen notes about this specific family. That's RAG: the AI maintains notes (vector embeddings in ChromaDB) about each user's cooking history, and before generating anything new, it retrieves the most relevant past recipes to guide the generation. The result is a recipe that feels "designed for me" — because it technically was.

---

**Q4: How is user data personalized?**

> Personalization happens at 4 levels: (1) **Registration-time** — BMI, calorie target, and macros are calculated on signup and stored. (2) **Profile-time** — dietary preferences, allergies, cuisine preferences, and health goal shape every recipe generation. (3) **Request-time** — the specific ingredients, meal type, and cuisine requested for this recipe. (4) **History-time (RAG)** — every meal the user has ever cooked is stored as a 384-dim vector in ChromaDB. When generating a new recipe, the top-5 most similar past recipes are retrieved and injected into the prompt, so Gemini knows this user likes dal makhani, cooks north Indian food, and prefers 30-minute recipes.

---

**Q5: What happens when a user uploads a food image?**

> The frontend converts the uploaded image to a base64 data URL and sends it in the request body as `image_base64`. The backend detects this and routes to `analyze_image_for_ingredients()` in `gemini_service.py`. This function makes a multi-modal Gemini Vision call — it sends both the image bytes and a text prompt asking Gemini to list the raw ingredients it can see. Gemini returns a JSON array like `["carrot", "potato", "onion"]`. These detected ingredients replace whatever the user typed, override the dietary preferences (since the user clearly intends to use what's in the photo), and are injected into the recipe generation prompt. The system also disables dietary preference filtering for the RAG retrieval, since the user's intent overrides their stored preferences.

---

**Q6: How does the health engine calculate recommended calories?**

> It uses the Mifflin-St Jeor equation, which is the most scientifically validated BMR formula. Step 1: Calculate BMR (calories burned at rest) using weight, height, age, and gender: `BMR = 10×W + 6.25×H - 5×A + 5` for males, `-161` for females. Step 2: Multiply by an activity factor of 1.4 to get TDEE (Total Daily Energy Expenditure). Step 3: Adjust for goal: subtract 500 for weight loss (creates ~0.5kg/week deficit), add 300 for muscle gain, keep as-is for maintenance. The result is a calorie target that's scientifically grounded in the user's actual physiology, not a generic "2000 calories" recommendation.

---

**Q7: Why did you choose Gemini over OpenAI?**

> We chose Google Gemini for 4 reasons: (1) **Cost** — Gemini has a generous free tier (1 million tokens/day on Flash) that was sufficient for our development and demo scale. GPT-4 would have been prohibitively expensive. (2) **Multimodal capability** — Gemini 1.5 Flash natively supports image + text in a single API call, which was essential for the food photo ingredient detection feature. (3) **JSON reliability** — Gemini with `temperature=0.4` produces consistent, parseable JSON output. Our testing showed fewer malformed JSON responses compared to GPT-3.5. (4) **Speed** — `gemini-flash-lite-latest` produces responses in 2-5 seconds, making the streaming experience smooth.

---

**Q8: What is ChromaDB and why use it over a regular database?**

> ChromaDB is a vector database — it stores high-dimensional numerical arrays (embeddings) and can find the most *similar* vectors to a query vector using cosine similarity. MongoDB, by contrast, can only find exact or range matches — you can ask "find recipes where cuisine = north_indian" but you cannot ask "find recipes that are most semantically similar to this query." ChromaDB enables semantic search: "what recipes are most similar to chicken biryani?" will surface "chicken pulao" and "lamb biryani" even though none of those exact words appeared in the query. This is what makes the RAG personalization work — we need similarity search, not keyword search.

---

**Q9: How do you ensure dietary restrictions are respected?**

> Three layers: (1) **Prompt constraint** — dietary preferences are explicitly stated in the system and user prompts: "STRICT RULE: ONLY pure vegetarian dishes." This works most of the time. (2) **RAG filter** — during retrieval, `dietary_filter` excludes recipes with incompatible `diet_type` metadata from reaching the prompt context. (3) **Rule checker** — after generation, `check_recipe()` scans every ingredient against the ALLERGEN_MAP and NON_VEG keyword list. If a violation is found, a warning is returned. The recipe isn't blocked — it's served with a warning banner, and the user decides. This design acknowledges that AI can make mistakes and puts the user in control.

---

**Q10: What is the difference between the two ChromaDB collections?**

> The `recipes` collection is the **global pool** — it contains every recipe ever generated across all users, plus any seeded data. It ensures there's always something to recommend, even for brand new users who haven't cooked anything yet. The `user_history` collection is the **personal memory** — it contains ONLY recipes that THIS specific user clicked "I Cooked This" on. It's filtered by `user_id` during retrieval. Personal history gets a 1.4x score boost because "what I actually ate" is more relevant than "what any random user ate." A new user starts with only global recipes, and their personal history grows meal by meal, making the system progressively more personalized over time.

---

**Q11: Explain the 8-step recipe generation pipeline.**

> Step 1: JWT authentication — validate the Bearer token, retrieve user document from MongoDB. Step 2: Pantry priority — fetch pantry items from MongoDB, score by expiry urgency (score 10 = use today, score 1 = fresh). Step 3: Health profile — compute BMI, TDEE, and meal calorie budgets using Mifflin-St Jeor. Step 4: Image detection (if image uploaded) — Gemini Vision analyzes the photo and extracts ingredient names, overriding typed ingredients. Step 5: RAG retrieval — embed the query using all-MiniLM-L6-v2, search ChromaDB user_history (×1.4 boost) + global recipes, get top-5 similar past meals. Step 6: Prompt construction — assemble system + user message with health data, RAG context, pantry expiry hints, dietary preferences. Step 7: Gemini generation — stream tokens from Gemini Flash, accumulate, parse JSON. Step 8: Rule check + save — run allergen/dietary checks, save recipe to MongoDB, return to client with any warnings.

---

**Q12: How does SSE streaming work?**

> Server-Sent Events is a one-way HTTP channel: the server keeps the response open and pushes frames as data becomes available. In this project, the frontend calls `GET /recipes/generate/stream` — a GET request (not POST, because SSE requires GET). The backend returns a `StreamingResponse` with `media_type="text/event-stream"`. The backend generator function `yield`s `data: {...}\n\n` frames: first "step" frames (progress messages), then "token" frames (raw Gemini output tokens), then a "complete" frame with the full parsed recipe, and finally a "warnings" frame. The frontend uses `fetch` + `ReadableStream` API to process these frames one-by-one, updating the UI incrementally — the user sees progress steps, then the AI thinking in real-time, then the finished recipe card.

---

**Q13: What is JWT and how is it used here?**

> JWT (JSON Web Token) is a digitally signed string that encodes user identity. It's three base64-URL encoded parts: header.payload.signature. The payload contains `{"sub": "user_mongo_id", "exp": timestamp, "type": "access"}`. The server signs it with a secret using HS256 (HMAC-SHA256). Anyone can decode the payload (it's base64, not encrypted) but only the server can verify the signature. In this project, login returns two JWTs: an access token (7 days, used for every API call) and a refresh token (30 days, used only to get new access tokens). The frontend stores both in localStorage. Every API call includes `Authorization: Bearer <access_token>`. The backend's `decode_access_token()` verifies the signature and extracts the user ID without a database lookup.

---

**Q14: How does the leftover optimizer reduce food waste?**

> The leftover optimizer works at two levels: (1) **Expiry-aware generation** — every recipe generation automatically includes the user's most urgently expiring pantry items in the prompt. Items expiring today get score 10, tomorrow score 9, within 5 days score 7. Gemini is instructed to "prioritize" these items in the recipe, so they get used before they go bad. (2) **Leftover logging** — after cooking, the user can log what was left over from the meal (e.g., "200g chicken, half cup rice"). These are stored in the `leftovers` collection. The `POST /leftovers/suggest` endpoint then asks Gemini: "Given these leftover ingredients, what can I make?" — suggesting dishes that use exactly what remains, minimizing waste.

---

**Q15: What technologies does the frontend use and why?**

> The frontend uses: **Next.js 14** (React framework with App Router — chosen for server-side rendering capability, great DX, and seamless Vercel deployment). **TypeScript** (type safety — prevents runtime errors from API shape mismatches). **Tailwind CSS** (utility-first CSS — rapid UI development with a consistent design system). **Zustand** (lightweight global state — simpler than Redux, perfect for auth state + token management). **Axios** (HTTP client — chosen over fetch for its interceptor system, which auto-attaches JWT to every request and auto-refreshes tokens on 401). **react-hot-toast** (non-blocking user notifications). **Lucide React** (icon library — tree-shakeable, consistent design). The tech stack was chosen for developer productivity, production scalability, and community support.

---

**Q16: How is data persisted between sessions?**

> Three persistence mechanisms work together: (1) **MongoDB** (backend) — all users, recipes, pantry items, meal plans, and food intake are persisted in MongoDB Atlas. This is the ground truth. (2) **ChromaDB** (backend) — the vector database uses `PersistentClient` to save embedding data to disk at `./chroma_db`. All user history survives server restarts. (3) **localStorage** (frontend) — Zustand's `persist` middleware saves the auth state (user object + tokens) to `localStorage['wk-auth']`. When the browser is reopened, the auth state is restored from localStorage, so the user doesn't need to log in again until their tokens expire.

---

**Q17: What would you improve if you had more time?**

> Several improvements: (1) **Real ingredient substitution** — currently basic; could use a specialized nutrition database (USDA) for accurate macro impacts of substitutions. (2) **ChromaDB on managed infrastructure** — ChromaDB's local persistence on Railway is fragile (data lost on deploy). Would switch to a ChromaDB Cloud or Pinecone instance. (3) **More signals for RAG** — currently only "cooked" meals are indexed. Could also index "saved" recipes with lower weight, giving the AI more signal. (4) **Better cold-start** — use cuisine and health goal from registration to seed initial ChromaDB entries. (5) **Recipe images** — integrate Stable Diffusion to generate actual food photos. (6) **Push notifications** — "You haven't logged dinner yet!" nudges for better tracking compliance.

---

**Q18: How does the meal planner generate 7 days of meals?**

> `POST /meal-planner/auto-fill/smart` sends a carefully engineered prompt to Gemini requesting a complete 7-day plan in a specific JSON schema. The prompt includes: calorie target per day, protein target, diet type (strict vegetarian/vegan/non-veg), selected cuisines (up to 3), health goal-specific rules (e.g., "weight loss: avoid fried foods, keep under X kcal"), and a constraint that no dish may repeat twice. Gemini returns a JSON object with 7 day objects, each containing 4 meal objects (breakfast/lunch/dinner/snack) with title, cuisine, calories, protein, cook time, and diet type. The backend validates the response, fills in any missing `diet_type` fields, and saves the plan to MongoDB under a `week_id` (ISO week format like `2026-W16`), so it can be retrieved on future dashboard visits.

---

**Q19: What is the role of the rule checker?**

> The rule checker (`rule_checker.py`) is the safety layer that runs AFTER Gemini generates a recipe. Gemini is generally reliable but not perfect — it might generate a paneer dish for a dairy-allergic user or include chicken in a vegetarian meal plan. The rule checker catches these mistakes by: (1) Checking every ingredient against the user's allergies using the ALLERGEN_MAP (which maps allergy categories like "dairy" to actual ingredient keywords like ["milk", "paneer", "ghee"]). (2) Checking if the recipe contains non-veg ingredients while the user has vegetarian preferences set — but ONLY if the user didn't explicitly request those ingredients themselves. (3) Checking for high-GI ingredients if the user is diabetic-friendly. Violations produce warnings with severity levels (high = allergen, medium = dietary). Critically, the recipe is not blocked — warnings are returned alongside the recipe and displayed to the user as informational banners.

---

**Q20: How is this project different from just using ChatGPT?**

> ChatGPT is a general-purpose AI with no knowledge of you. This project builds a complete application layer on top of AI that adds: (1) **Identity** — you have an account, health profile, dietary restrictions, and history. ChatGPT treats every conversation as new. (2) **Persistent memory** — every meal you cook is stored in ChromaDB and retrieved next time to personalize suggestions. ChatGPT forgets everything. (3) **Health integration** — your BMI, calorie targets, and macro goals from the Mifflin-St Jeor equation shape every recipe. ChatGPT doesn't know your physiology. (4) **Food system** — pantry management, expiry tracking, leftover optimization. ChatGPT doesn't know what's in your fridge. (5) **Real-time streaming** — recipes appear token by token with progress steps. ChatGPT's API is request-response. (6) **Safety layer** — allergen and dietary rule checking runs post-generation. (7) **Data storage** — your recipe history, health stats, and meal plans are stored in MongoDB and queryable. Essentially, this is ChatGPT wrapped in 3000+ lines of product logic that makes it a real application, not just a chat window.

---

# SECTION 8: QUICK REFERENCE CHEAT SHEET

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | Next.js 14 (App Router) | React SSR framework |
| **Language** | TypeScript | Type-safe frontend |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **State Management** | Zustand + persist | Global auth state |
| **HTTP Client** | Axios + interceptors | Auto-JWT, auto-refresh |
| **Backend Framework** | FastAPI (Python) | Async REST API |
| **Async DB Driver** | Motor (async MongoDB) | Non-blocking DB calls |
| **Primary Database** | MongoDB Atlas | Users, recipes, pantry, plans |
| **Vector Database** | ChromaDB PersistentClient | RAG embeddings |
| **AI Model** | Google Gemini Flash | Recipe generation + vision |
| **Embeddings** | sentence-transformers all-MiniLM-L6-v2 | 384-dim vectors |
| **Auth** | JWT (python-jose) | Stateless authentication |
| **Password Hashing** | bcrypt | Secure password storage |
| **Frontend Deploy** | Vercel | Auto-deploy from GitHub |
| **Backend Deploy** | Railway | Python container |

---

## Key Numbers

| Metric | Value |
|---|---|
| Embedding dimensions | **384** (all-MiniLM-L6-v2) |
| User history RAG boost | **1.4×** score multiplier |
| Access token expiry (dev) | **10080 minutes (7 days)** |
| Refresh token expiry | **30 days** |
| ChromaDB collections | **2** (recipes, user_history) |
| Recipe generation pipeline steps | **8** |
| Gemini model (generation) | **gemini-flash-lite-latest** (primary) |
| Gemini model (vision) | **gemini-1.5-flash** (primary) |
| Token budget (recipe) | **2200 tokens** |
| Token budget (meal plan) | **3500 tokens** |
| Gemini temperature | **0.4** (low, for consistent JSON) |
| MongoDB connection pool | **maxPoolSize=50** |
| Pantry expiry score = "use today" | **10** (days_until_expiry == 0) |
| Critical expiry threshold | **score ≥ 9** (0-2 days) |

---

## Key Endpoints

```
AUTH
POST  /auth/register          Register new user, returns tokens + user profile
POST  /auth/login             Authenticate, returns access + refresh tokens
GET   /auth/me                Get current user from token (no body needed)
POST  /auth/refresh           Exchange refresh token for new access token

RECIPES
POST  /recipes/generate       Non-streaming recipe generation (returns full JSON)
GET   /recipes/generate/stream SSE streaming — real-time recipe tokens
GET   /recipes/user/{userId}  Get user's recipe history (paginated)
POST  /recipes/{id}/cooked    "I Cooked This" — indexes to RAG + logs intake
PUT   /recipes/{id}/save      Toggle bookmark/save on a recipe
DELETE /recipes/{id}          Delete a recipe

PANTRY
GET   /pantry/expiring        Items expiring within N days (MUST BE BEFORE /{user_id})
GET   /pantry/{user_id}       All pantry items sorted by expiry
POST  /pantry/item            Add pantry item
PUT   /pantry/item/{id}       Update item (recalculates freshness)
DELETE /pantry/item/{id}      Delete item
POST  /pantry/optimize        AI suggestions for expiring pantry items

HEALTH
GET   /health/stats/{userId}  BMI, TDEE, calorie target, macros
PUT   /health/profile/{userId} Update health profile, recalculate targets
GET   /health/history/{userId} BMI/weight history (last N days)
POST  /health/intake/log      Log a meal to today's intake
GET   /health/intake/today    Today's calorie/macro summary
GET   /health/cooked-meals    Last 7 days of meals (for food calendar)

MEAL PLANNER
POST  /meal-planner/auto-fill/smart  Generate 7-day AI meal plan
GET   /meal-planner/{userId}         Get current week's plan
POST  /meal-planner/slot            Add individual meal to plan
DELETE /meal-planner/slot/{w}/{d}/{m} Remove a meal slot

LEFTOVERS
POST  /leftovers/log          Log leftover ingredients from a meal
GET   /leftovers/my           Get all unused leftovers
POST  /leftovers/suggest      AI suggestions using current leftovers
PUT   /leftovers/{id}/used    Mark leftover as used

SUGGESTIONS & RAG
GET   /suggestions/daily      6 personalized meal suggestions + RAG history suggestions
GET   /rag/status             ChromaDB collection counts (debug endpoint)
```

---

## Flow Summary Cards

### "I Cooked This" Flow
```
Button click → POST /recipes/{id}/cooked
→ mark cooked in MongoDB
→ index_recipe(recipe, user_id, cooked=True)
   → embed recipe text → 384-dim vector
   → store in user_history ChromaDB collection
→ log to food_intake collection (calories, protein, etc.)
→ return calories_remaining for the day
```

### Recipe Generation Flow
```
user types ingredients → /recipes/generate/stream SSE
→ JWT auth → pantry (expiry-sorted) → health profile
→ RAG: embed query → chromadb cosine search → top-5 recipes
→ prompt: system + user + health + RAG context + expiry hints
→ Gemini generates JSON → streams tokens to browser
→ rule checker (allergen + dietary)
→ save to MongoDB → send to frontend
```

### New User Registration Flow
```
fill form → POST /auth/register
→ validate (Pydantic schema)
→ check email uniqueness in MongoDB
→ BMI = weight / height² → categorize
→ BMR (Mifflin-St Jeor) → TDEE = BMR × 1.4
→ calorie_target per goal → macro split
→ bcrypt hash password → insert MongoDB
→ create access + refresh JWT
→ return tokens + full user profile → auto-login
```

---

*End of VIVA Guide — Generated from complete codebase analysis*  
*All code references are accurate as of the current working codebase.*
