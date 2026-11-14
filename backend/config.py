"""App settings: secrets from .env, stuck rules, hint limits, model names."""

import os

from dotenv import load_dotenv

load_dotenv()

# --- Secrets (from .env) ---
MONGODB_URI = os.getenv("MONGODB_URI", "")
MONGODB_DB = os.getenv("MONGODB_DB", "mentorthena")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# --- Mode ---
# DEMO_MODE=1 uses short thresholds so judges see a ship turn yellow in seconds.
DEMO_MODE = os.getenv("DEMO_MODE", "1") == "1"

# --- Argus stuck rules ---
_NORMAL_RULES = {
    "idle_seconds": 60,          # no key press or cursor move
    "churn_window_seconds": 30,  # window for the type-and-delete rule
    "churn_delete_ratio": 0.7,   # deleted keys / typed keys
    "churn_min_keys": 20,        # ignore tiny edits
    "same_error_runs": 3,        # same error N runs in a row
    "wrong_output_runs": 3,      # runs fine but wrong output N times
    "hint_cooldown_seconds": 45, # min time between two hints for one student
}

_DEMO_RULES = {
    **_NORMAL_RULES,
    "idle_seconds": 15,
    "same_error_runs": 2,
    "wrong_output_runs": 2,
    "hint_cooldown_seconds": 10,
}

STUCK_RULES = _DEMO_RULES if DEMO_MODE else _NORMAL_RULES

# Frontend sends a heartbeat this often (seconds).
HEARTBEAT_SECONDS = 10

# --- Athena hint limits ---
MAX_HINT_LEVEL = 3           # after level 3, the ship turns red for the teacher
MAX_SIREN_REWRITES = 1       # then fall back to a canned hint
GEMINI_TIMEOUT_SECONDS = 8   # then fall back to a canned hint

# --- Tiresias ---
INSIGHT_CACHE_SECONDS = 60

# --- Gemini models ---
# Verify these names in Google AI Studio during Step 6; override in .env if needed.
GEMINI_TEXT_MODEL = os.getenv("GEMINI_TEXT_MODEL", "gemini-2.5-flash")
GEMINI_EMBED_MODEL = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")

# --- Server ---
PORT = int(os.getenv("PORT", "5000"))
