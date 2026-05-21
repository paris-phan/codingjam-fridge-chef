"""FridgeChef — FastAPI server + Gemini API recipe & food image generation."""

import base64
import os
import json
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from google import genai
from google.genai import types

from prompts import (
    RecipeResponse,
    PERSONALITY_PROMPTS,
    DEFAULT_PERSONALITY,
    VALID_PERSONALITIES
)

# Load environment variables
load_dotenv()

app = FastAPI(title="FridgeChef")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model definitions
MODEL_TEXT = "gemini-2.5-flash"
MODEL_IMAGE = "imagen-3.0-generate-002"

def _create_client():
    """Create a fresh Gemini client for each request to prevent OpenSSL reuse errors."""
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        return genai.Client(api_key=api_key)
    # Fallback to Vertex AI if key not present
    return genai.Client(
        vertexai=True,
        project=os.getenv("GOOGLE_CLOUD_PROJECT"),
        location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )


# --- Request/Response Models ---

class RecipeRequest(BaseModel):
    ingredients: List[str] = Field(..., min_items=1, description="List of ingredients in the fridge")
    chef_personality: str = Field(DEFAULT_PERSONALITY, description="Selected culinary voice for the AI chef")


# --- Utilities ---

def process_image_to_base64(image_bytes_data) -> str:
    """Bulletproof conversion of image data from the SDK to base64 Data URI.
    
    Handles raw image bytes, base64-encoded strings, and base64-encoded bytes.
    """
    if not image_bytes_data:
        return ""
        
    data_bytes = image_bytes_data
    if isinstance(image_bytes_data, str):
        try:
            data_bytes = image_bytes_data.encode('utf-8')
        except Exception:
            pass
            
    # Check if this starts with raw JPEG or PNG magic bytes
    is_jpeg = data_bytes.startswith(b'\xff\xd8\xff')
    is_png = data_bytes.startswith(b'\x89PNG')
    
    if is_jpeg or is_png:
        encoded = base64.b64encode(data_bytes).decode('utf-8')
        mime = "image/png" if is_png else "image/jpeg"
        return f"data:{mime};base64,{encoded}"
        
    # If not raw magic bytes, it might be base64-encoded. Verify by trying to decode it.
    try:
        decoded = base64.b64decode(data_bytes)
        if decoded.startswith(b'\xff\xd8\xff'):
            return f"data:image/jpeg;base64,{data_bytes.decode('utf-8')}"
        elif decoded.startswith(b'\x89PNG'):
            return f"data:image/png;base64,{data_bytes.decode('utf-8')}"
    except Exception:
        pass
        
    # Safe fallback: assume raw bytes and encode it
    encoded = base64.b64encode(data_bytes).decode('utf-8')
    return f"data:image/jpeg;base64,{encoded}"


# --- Routes ---

@app.post("/api/recipe")
async def generate_recipe(request: RecipeRequest):
    """Generates a recipe and an accompanying food photo based on the ingredients list."""
    
    # 1. Input sanitization and validation
    cleaned_ingredients = [item.strip() for item in request.ingredients if item.strip()]
    if not cleaned_ingredients:
        raise HTTPException(
            status_code=400,
            detail="Please provide at least one valid ingredient."
        )
        
    personality = request.chef_personality.lower().strip()
    if personality not in VALID_PERSONALITIES:
        personality = DEFAULT_PERSONALITY
        
    system_instruction = PERSONALITY_PROMPTS[personality]
    
    # 2. Recipe text generation with structured Pydantic output
    client = _create_client()
    
    ingredients_str = ", ".join(cleaned_ingredients)
    user_prompt = f"""I have these ingredients in my fridge: {ingredients_str}.
    
Please devise ONE perfect recipe using these. You can supplement with standard kitchen staples (oil, salt, pepper, garlic, water, butter, etc.).
Return only a valid JSON object matching the requested schema."""

    try:
        recipe_response = client.models.generate_content(
            model=MODEL_TEXT,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
                response_mime_type="application/json",
                response_schema=RecipeResponse,
            )
        )
        
        # Load the structured JSON response
        recipe_data = json.loads(recipe_response.text.strip())
        
    except Exception as e:
        print(f"Recipe text generation error: {e}")
        raise HTTPException(
            status_code=500,
            detail="The chef is currently occupied in the kitchen. Let's try again in a moment!"
        )

    # 3. Custom image prompt generation based on recipe and personality
    recipe_title = recipe_data.get("title", "Delicious Creation")
    recipe_ingredients = recipe_data.get("ingredients", cleaned_ingredients)
    
    # Tailor the photo background styling to the chef's culinary voice
    if personality == "grandma":
        background_style = "cozy home-style kitchen background, warm soft natural lighting, rustic wooden table"
    elif personality == "bistro":
        background_style = "sleek slate plate, dark industrial bistro table background, modern moody high-contrast lighting"
    else: # gourmet
        background_style = "elegant minimalist white ceramic plate, high-end fine dining restaurant background, bright clean studio lighting, delicate microgreen garnish"
        
    image_prompt = (
        f"Professional commercial food photography of {recipe_title}. "
        f"A beautifully plated, delicious dish containing {', '.join(recipe_ingredients[:4])}. "
        f"Shot on a {background_style}, editorial culinary magazine style, shallow depth of field, appetizing, close-up shot."
    )
    
    # 4. Food image generation using Imagen 3
    base64_image_uri = ""
    try:
        image_response = client.models.generate_images(
            model=MODEL_IMAGE,
            prompt=image_prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="1:1",
                output_mime_type="image/jpeg"
            )
        )
        
        if image_response.generated_images:
            raw_image_data = image_response.generated_images[0].image.image_bytes
            base64_image_uri = process_image_to_base64(raw_image_data)
            
    except Exception as e:
        print(f"Image generation error: {e}")
        # We don't want to crash the whole request if image generation fails.
        # We return a placeholder or allow the frontend to gracefully handle missing images.
        base64_image_uri = ""

    # Combine text and image into a unified response
    return {
        "recipe": recipe_data,
        "image": base64_image_uri,
        "chef_personality": personality
    }


@app.get("/api/health")
async def health_check():
    """Simple status check."""
    return {"status": "cooking"}


# Mount static files for the frontend (must be last)
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
else:
    # Create the directory if it doesn't exist so mounting doesn't crash on startup
    os.makedirs(frontend_path, exist_ok=True)
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
