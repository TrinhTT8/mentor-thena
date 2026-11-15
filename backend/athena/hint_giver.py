"""Athena: turns a stuck student's situation into one kid-level hint.

Person A's code calls get_hint() when Argus decides a student needs help.
Gemini writes the hint; if Gemini fails or is slow, a backup hint is used so the kid always sees something.
"""

import logging

import config
from athena.fallbacks import fallback_hint
from athena.prompts import SYSTEM_PROMPT, HintResult, build_hint_prompt
from gemini_client import generate_json

log = logging.getLogger(__name__)

CUES = {"idle", "churn", "same_error", "wrong_output"}


def get_hint(student, task, snapshot, level, cue, past_hints=None):
    """Return one hint for a student.

    student:  the student document (only used for logging here)
    task:     {"title", "instructions", "expected_output"}
    snapshot: {"code", "error", "output"} from the latest run or heartbeat
    level:    1, 2 or 3 (Argus decides; values outside are clamped)
    cue:      "idle", "churn", "same_error" or "wrong_output"
    past_hints: hint texts this student already saw for this task (so Gemini doesn't repeat)

    Returns {"text", "reason", "concept", "level", "from_ships_log", "siren_blocked", "source"}.
    """
    level = max(1, min(int(level), config.MAX_HINT_LEVEL))
    if cue not in CUES:
        cue = "same_error"

    prompt = build_hint_prompt(
        task=task,
        code=snapshot.get("code", ""),
        error=snapshot.get("error", ""),
        output=snapshot.get("output", ""),
        expected_output=task.get("expected_output", ""),
        level=level,
        cue=cue,
        past_hints=past_hints,
        ships_log_hint=None,  # B10: the Ship's Log fills this in later
    )

    if not config.USE_GEMINI:  # switched off in .env: save the daily Gemini budget
        text, reason, concept = fallback_hint(snapshot, task, level, why="Gemini switched off")
        return _package(text, reason, concept, level, source="fallback")

    try:
        result = generate_json(prompt, HintResult, system=SYSTEM_PROMPT)
        return _package(result.hint, result.reason, result.concept, level, source="gemini")
    except Exception as exc:  # timeout, rate limit, Gemini down, bad JSON: never crash the request
        log.warning("Gemini hint failed for student %s: %s", student.get("_id"), exc)
        text, reason, concept = fallback_hint(snapshot, task, level)
        return _package(text, reason, concept, level, source="fallback")


def _package(text, reason, concept, level, source):
    return {
        "text": text.strip(),
        "reason": reason.strip(),
        "concept": concept,
        "level": level,
        "from_ships_log": False,   # B10 sets this when a Ship's Log hint was used
        "siren_blocked": False,    # B9 sets this when Siren Guard blocked a leaking hint
        "source": source,          # "gemini" or "fallback", handy for debugging and the demo
    }
