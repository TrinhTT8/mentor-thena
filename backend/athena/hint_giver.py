"""Athena: turns a stuck student's situation into one kid-level hint.

Person A's code calls get_hint() when Argus decides a student needs help.
Gemini writes the hint; if Gemini fails or is slow, a backup hint is used so the kid always sees something.
"""

import logging

import config
from athena.fallbacks import fallback_hint
from athena.prompts import SYSTEM_PROMPT, HintResult, build_hint_prompt
from athena.siren_guard import guard
from gemini_client import generate_json
from ships_log.memory import find_similar_hint

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

    if not config.USE_GEMINI:  # switched off in .env: save the daily Gemini budget
        text, reason, concept = fallback_hint(snapshot, task, level, why="Gemini switched off")
        return _package(text, reason, concept, level, source="fallback")

    # Ship's Log (Person A): a hint that helped another student with a similar bug, or None.
    ships_log_hint = find_similar_hint(snapshot.get("error", ""), past_hints)

    prompt = build_hint_prompt(
        task=task,
        code=snapshot.get("code", ""),
        error=snapshot.get("error", ""),
        output=snapshot.get("output", ""),
        expected_output=task.get("expected_output", ""),
        level=level,
        cue=cue,
        past_hints=past_hints,
        ships_log_hint=ships_log_hint,
    )

    try:
        result = generate_json(prompt, HintResult, system=SYSTEM_PROMPT)
    except Exception as exc:  # timeout, rate limit, Gemini down, bad JSON: never crash the request
        log.warning("Gemini hint failed for student %s: %s", student.get("_id"), exc)
        text, reason, concept = fallback_hint(snapshot, task, level)
        return _package(text, reason, concept, level, source="fallback")

    # Siren Guard (Person A): block and fix hints that give the answer away. Never raises.
    checked = guard(result.hint, result.reason, result.concept, prompt, task, snapshot, level)
    return _package(checked["text"], checked["reason"], checked["concept"], level,
                    source=checked["source"], from_ships_log=ships_log_hint is not None,
                    siren_blocked=checked["siren_blocked"])


def _package(text, reason, concept, level, source, from_ships_log=False, siren_blocked=False):
    return {
        "text": text.strip(),
        "reason": reason.strip(),
        "concept": concept,
        "level": level,
        "from_ships_log": from_ships_log,  # True when a Ship's Log hint inspired this one
        "siren_blocked": siren_blocked,    # True when Siren Guard blocked a hint that gave the answer away
        "source": source,          # "gemini" or "fallback", handy for debugging and the demo
    }
