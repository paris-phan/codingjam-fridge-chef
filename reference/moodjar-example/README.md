# 🫙 MoodJar — Reference Implementation

**Drop a thought, receive warmth.** A gentle AI-powered comfort app where you write anything — the weather, someone you thought of, something that just happened — and receive a beautiful, shareable card with 3 comforting sentences and a relevant emoji.

---

## What Is This?

MoodJar is a single-screen web app that creates a gentle ritual: write a thought → drop it in your jar → receive warmth back. It uses **Google Gemini AI** to generate specific, warm responses matched to whatever you wrote.

The result is displayed on a stunning glassmorphism card designed to be **screenshotted and shared**.

---

## Project Structure

```
moodjar-example/
├── README.md                     # This file
├── frontend/
│   ├── index.html                # Single-page UI (input → loading → card)
│   ├── style.css                 # Design system (warm pastels, glassmorphism)
│   ├── app.js                    # State machine, API calls, animations
│   └── jar.js                    # Jar rendering, slip management, shake
└── backend/
    ├── main.py                   # FastAPI server + Gemini AI integration
    ├── prompts.py                # AI system prompt configuration
    ├── pyproject.toml            # Python project config (for uv)
    ├── requirements.txt          # Python dependencies (for pip)
    └── .env.example              # API key configuration template
```

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Backend  | Python, FastAPI, Uvicorn                |
| AI       | Google Gemini via `google-genai` SDK    |
| Frontend | Vanilla HTML/CSS/JS                     |
| Fonts    | Lora + Inter (Google Fonts)             |
| Design   | Warm pastel palette, glassmorphism, CSS bokeh & sunlight effects |

---

## How to Run

```bash
cd backend
uv sync                           # install dependencies
cp .env.example .env              # add your credentials
uv run uvicorn main:app --reload  # start server at http://localhost:8000
```

The backend serves the frontend as static files — everything runs from one URL.

---

## API

### `POST /api/generate`

**Request:**
```json
{ "thought": "The sky looked different today…" }
```

**Response:**
```json
{
  "emoji": "🌅",
  "sentences": [
    "First warm sentence.",
    "Second warm sentence.",
    "Third warm sentence."
  ],
  "mood": "gentle",
  "slipLabel": "A different sky"
}
```

### `GET /api/health`

Returns `{"status": "sunny"}`.

---

## Key Patterns (for AI assistants)

1. **Gemini Client Setup** — See `main.py` for API key vs Vertex AI auto-detection
2. **Structured JSON Output** — Uses `response_mime_type="application/json"` for reliable parsing
3. **System Prompt Design** — See `prompts.py` for detailed, rule-based prompt engineering
4. **Static File Serving** — FastAPI mounts the frontend directory at `/`
5. **Glassmorphism CSS** — See `style.css` for the full design system with bokeh and sunray effects
