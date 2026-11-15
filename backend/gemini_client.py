"""One shared Gemini client for the backend: JSON generation and embeddings."""

from google import genai
from google.genai import types

import config

if not config.GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing. Add it to backend/.env.")

client = genai.Client(
    api_key=config.GEMINI_API_KEY,
    http_options=types.HttpOptions(timeout=config.GEMINI_TIMEOUT_SECONDS * 1000),  # milliseconds
)

# Our users are 8-10 years old: block anything even slightly harmful, in every category.
KID_SAFETY = [
    types.SafetySetting(category=category, threshold=types.HarmBlockThreshold.BLOCK_LOW_AND_ABOVE)
    for category in (
        types.HarmCategory.HARM_CATEGORY_HARASSMENT,
        types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    )
]


def generate_json(prompt, schema, system=None, model=None,
                  temperature=config.HINT_TEMPERATURE, max_tokens=config.HINT_MAX_TOKENS):
    """Ask Gemini for JSON that matches `schema` (a Pydantic model). Returns an instance of it.

    Raises on timeout, safety block, cut-off or bad output; callers should fall back to a ready-made hint.
    """
    response = client.models.generate_content(
        model=model or config.GEMINI_TEXT_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=schema,
            temperature=temperature,
            max_output_tokens=max_tokens,
            safety_settings=KID_SAFETY,
        ),
    )
    if response.parsed is None:
        raise ValueError(f"Gemini returned no parsable JSON: {response.text!r}")
    return response.parsed


def embed(text):
    """Turn text into a vector (list of floats) for the Ship's Log."""
    result = client.models.embed_content(
        model=config.GEMINI_EMBED_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=config.EMBED_DIMENSIONS),
    )
    return list(result.embeddings[0].values)
