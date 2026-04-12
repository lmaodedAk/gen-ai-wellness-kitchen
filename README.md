# 🥗 GenAI Personalized Wellness Kitchen

An AI-powered, context-aware personalized recipe and health tracking web application. The platform uses multi-modal Generative AI, Retrieval-Augmented Generation (RAG), and a custom Health Engine to provide hyper-personalized meal recommendations, ingredient tracking, and nutritional monitoring tailored to user constraints.

## ✨ Key Features

### 🧠 1. Multi-Modal GenAI Recipe Generation
- **Image-to-Recipe (Gemini Vision):** Upload a photo of ingredients/leftovers, and the system uses `gemini-1.5-flash` to visually identify the actual ingredients and strictly generate a bespoke recipe utilizing only what it sees.
- **Context-Aware Prompting:** Recipes are dynamically generated taking into account the user's BMI, active calorie targets, macro splits (Protein/Fat/Carbs), allergies, and dietary constraints (Vegan, Veg, etc.).

### 📚 2. AI Memory (Retrieval-Augmented Generation)
- **Personalized RAG Engine:** Built with `ChromaDB` and `SentenceTransformers`.
- **Cooked History Syncing:** Every time you click "I Cooked This", the recipe is vectorized and stored in a specialized User History collection.
- **Context Feed:** When asking for new recipes, the RAG engine retrieves similar past meals the user enjoyed, passing them to the LLM to guide flavor profiles and suggestions, creating a truly evolving "AI Memory".

### 📊 3. Smart Health Engine & Calorie Tracking
- **Automated Macro Targets:** Computes TDEE, BMR, and BMI upon profile creation, assigning scientific macro distributions based on goals (e.g., Maintain, Weight Loss, Muscle Gain).
- **Daily Intake Logging:** Manually log consumed meals or mark AI-generated recipes as cooked. The dashboard ring meter dynamically tracks remaining calories throughout the day entirely synced with the backend Database.
- **Activity Tracker:** Log burnt calories from gym/workouts to adjust daily intake budgets properly.

### 🥫 4. Pantry & Leftover Optimizer
- **Inventory Management:** Add ingredients to the digital pantry.
- **Smart Prioritization:** When generating a recipe naturally, the solver pulls items marked as "Expiring Soon" and forces the AI prompt to construct a zero-waste recipe using those specific ingredients.

## 🛠️ Technology Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Custom sleek, modern aesthetic with glassmorphism effects)
- **State Management:** Zustand (for lightweight, persistent authentication stores)
- **Deployment:** Vercel

### Backend
- **Framework:** FastAPI (High-performance Async Python)
- **Database:** MongoDB (using `motor` async driver)
- **Vector Database:** ChromaDB (for high-speed local RAG document retrieval)
- **AI Models:** Google Gemini (`gemini-1.5-flash` for multi-modal text and vision via `google-generativeai`)
- **Authentication:** JWT (JSON Web Tokens) with short-lived access tokens and refresh tokens.
- **Deployment:** Railway (Dockerized container)

## 🏗️ Architecture & Workflows

1. **The Generation Pipeline:**  
   `User Request (Image or Text)` ➝ `RAG Retrieval (checking dietary filters & history)` ➝ `Dietary Rule Constraints Applied` ➝ `Prompt Builder (Injecting BMI/Health data)` ➝ `Gemini API Stream Response` ➝ `Client UI Server-Sent Events (SSE) Render`

2. **The Intake Pipeline:**  
   `Mark Cooked` ➝ `Write to MongoDB 'food_intake'` ➝ `Re-compute Total_Cal` ➝ `Return to Client & Trigger Global JS Event` ➝ `Health Stats Instantly Renders Update`

## 🚀 Local Development Setup

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB instance (Local or Atlas)
- Google Gemini API Key

### Next.js Frontend Setup
```bash
cd frontend
npm install
# Create a .env.local file:
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

### FastAPI Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Create a .env file:
# GEMINI_API_KEY=your_key_here
# MONGODB_URI=mongodb://localhost:27017
# JWT_SECRET=your_super_secret

uvicorn main:app --reload --port 8000
```

## 🔒 Security
- **Data Protection:** bcrypt password hashing.
- **API Guarding:** FastAPI dependencies enforce Bearer Token auth on all critical endpoints.
- **Cross-Origin:** Configured CORS middleware separating production origins safely.
