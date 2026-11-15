"""Ship's Log: remembers hints that helped, so Athena can reuse them.

Two jobs:
- save_helpful(): when a student reaches Ithaca after a hint, save that hint
  with an embedding (a list of numbers that captures what the bug means).
- find_similar_hint(): when a new student is stuck, find a saved hint for
  a similar bug with Atlas Vector Search.

Only bugs with an error message are used. "Wrong output" bugs look the same
across different tasks, so a match could be about another task.
Nothing here ever raises: a Ship's Log problem must not break a hint or Ithaca.

Written by Person A (agreed with Person B).
"""

import logging
import re
from datetime import datetime, timezone

import config
from athena.fallbacks import detect_concept
from db import ship_log
from gemini_client import embed

log = logging.getLogger(__name__)

VECTOR_INDEX_NAME = "ship_log_vector"

# How close a past bug must be to count as "similar".
# Atlas gives a score from 0 to 1 (1 = the same meaning).
MIN_SIMILARITY = 0.9

# How many lines to keep before and after the error line.
SUMMARY_LINES_AROUND = 1


def short_error(error):
    """The last line of the error, like "SyntaxError: expected ':'".

    Python's full error message also has file paths and line numbers,
    which would make two equal bugs look different.
    """
    if not error:
        return ""

    lines = []
    for line in error.strip().split("\n"):
        if line.strip():
            lines.append(line.strip())

    if len(lines) == 0:
        return ""
    return lines[-1]


def bug_text(error):
    """The text we turn into an embedding: "concept | short error"."""
    error_line = short_error(error)
    concept = detect_concept(error=error)
    return f"{concept} | {error_line}"


def find_error_line_number(error):
    """The line number in the student's code where the error happened, or None."""
    # Errors from the student's code say: File "<exec>", line 3
    numbers = re.findall(r'"<exec>", line (\d+)', error)

    # Some errors only say "line 3".
    if len(numbers) == 0:
        numbers = re.findall(r"line (\d+)", error)

    if len(numbers) == 0:
        return None

    # The last one is closest to where the error really happened.
    return int(numbers[-1])


def code_summary(code, error):
    """A few lines of the code around the error, not the whole program.

    Keeps the error line plus one line before and after it.
    If the error has no line number: the first 3 and last 3 lines.
    """
    if not code:
        return ""

    lines = code.replace("\r\n", "\n").split("\n")

    line_number = None
    if error:
        line_number = find_error_line_number(error)

    if line_number is not None and 1 <= line_number <= len(lines):
        start = max(0, line_number - 1 - SUMMARY_LINES_AROUND)
        end = min(len(lines), line_number + SUMMARY_LINES_AROUND)
        return "\n".join(lines[start:end])

    # No usable line number: keep the start and the end.
    if len(lines) <= 6:
        return "\n".join(lines)

    first_lines = lines[:3]
    last_lines = lines[-3:]
    return "\n".join(first_lines + ["..."] + last_lines)


def save_helpful(hint, snapshot):
    """Save a hint that helped a student reach Ithaca. Returns None.

    hint is the hint document from the hints collection. It holds the
    error and code_summary from when the student was stuck.
    snapshot is the successful run (not used: the bug is already fixed there).
    """
    try:
        # Switched off in .env: no embeddings, zero Gemini requests.
        if not config.USE_GEMINI:
            return None

        error = hint.get("error")
        if not error:
            return None

        # Backup hints are already in athena/fallbacks.py.
        if hint.get("source") != "gemini":
            return None

        # Already in the log: it helped one more student.
        existing = ship_log.find_one({"hint_text": hint["text"]})
        if existing is not None:
            ship_log.update_one(
                {"_id": existing["_id"]},
                {"$inc": {"times_helped": 1}},
            )
            return None

        text = bug_text(error)
        ship_log.insert_one({
            "error": short_error(error),
            "code_summary": hint.get("code_summary", ""),
            "concept": hint.get("concept"),
            "bug_text": text,
            "hint_text": hint["text"],
            "embedding": embed(text),
            "times_helped": 1,
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as error_message:
        log.warning("Ship's Log save failed: %s", error_message)

    return None


def find_similar_hint(error, past_hints=None):
    """Return the text of a past hint for a similar bug, or None.

    Skips hints this student has already seen.
    """
    try:
        # Switched off in .env: no embeddings, zero Gemini requests.
        if not config.USE_GEMINI:
            return None

        if not error:
            return None

        if past_hints is None:
            past_hints = []

        query_vector = embed(bug_text(error))

        pipeline = [
            {"$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": 50,
                "limit": 3,
            }},
            {"$project": {
                "_id": 0,
                "hint_text": 1,
                "score": {"$meta": "vectorSearchScore"},
            }},
        ]

        for match in ship_log.aggregate(pipeline):
            if match["score"] < MIN_SIMILARITY:
                continue
            if match["hint_text"] in past_hints:
                continue
            return match["hint_text"]
    except Exception as error_message:
        log.warning("Ship's Log search failed: %s", error_message)

    return None
