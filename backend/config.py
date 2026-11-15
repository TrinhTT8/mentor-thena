"""App settings: secrets from .env, stuck rules, hint limits, model names."""

import os

from dotenv import load_dotenv

load_dotenv()

# --- Secrets (from .env) ---
MONGODB_URI = os.getenv("MONGODB_URI", "")
MONGODB_DB = os.getenv("MONGODB_DB", "mentorthena")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# --- Argus stuck rules ---
STUCK_RULES = {
    "idle_seconds": 7,          # no key press or cursor move
    "churn_window_seconds": 20,  # window for the type-and-delete rule (a multiple of HEARTBEAT_SECONDS)
    "churn_delete_ratio": 0.7,   # deleted keys / typed keys
    "churn_min_keys": 12,        # ignore tiny edits
    "same_error_runs": 1,        # same error N runs in a row
    "wrong_output_runs": 1,      # runs fine but wrong output N times
    "hint_cooldown_seconds": 30, # min time between two idle or type-and-delete hints (Run hints don't wait)
}

# Frontend sends a heartbeat this often (seconds).
HEARTBEAT_SECONDS = 10

# --- Athena hint limits ---
MAX_HINT_LEVEL = 3           # after level 3, the ship turns red for the teacher
MAX_SIREN_REWRITES = 1       # then fall back to a canned hint
GEMINI_TIMEOUT_SECONDS = 10  # then fall back to a canned hint (10 s is the API's minimum)

# --- Tiresias ---
INSIGHT_CACHE_SECONDS = 60

# --- Gemini on/off switch ---
# USE_GEMINI=0 in .env: Athena uses the free backup hints and makes zero Gemini requests
# (use it while building the frontend). Set USE_GEMINI=1 for real testing and the demo.
USE_GEMINI = os.getenv("USE_GEMINI", "1") == "1"

# --- Gemini models ---
# Timed on 2026-11-14: 3.5-flash-lite answered in ~4 s; 3.8-flash was overloaded (503),
# 3.5-flash took ~20 s, 2.5-flash returned 404. Override in .env if needed.
GEMINI_TEXT_MODEL = os.getenv("GEMINI_TEXT_MODEL", "gemini-3.5-flash-lite")
GEMINI_EMBED_MODEL = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-2")
EMBED_DIMENSIONS = 768  # smaller vectors fit the free Atlas tier; must match the Vector Search index

# --- Gemini generation settings (parameter tuning) ---
HINT_TEMPERATURE = 0.4    # 0 = always the same words, 1+ = creative; low keeps hints on-rule
HINT_MAX_TOKENS = 200     # hard cap on answer length (hint + reason + concept fit in ~80 tokens)

# --- Server ---
PORT = int(os.getenv("PORT", "5000"))
