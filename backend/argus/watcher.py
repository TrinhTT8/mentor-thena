"""Argus: simple rules (no AI) that notice when a student is stuck.

These functions only look at numbers and text. They never read or
write MongoDB. The snapshot route in app.py saves what they return.

The 4 cues:
- same_error:   the same error on 3 runs in a row
- wrong_output: the code runs, but the output is wrong 3 runs in a row
- idle:         no key press AND no cursor move for 60 seconds
- churn:        typing and deleting a lot over the last 3 heartbeats
"""

from datetime import timezone

import config

RULES = config.STUCK_RULES

# How many heartbeats make up the churn window (30 s / 10 s = 3).
CHURN_HEARTBEATS = RULES["churn_window_seconds"] // config.HEARTBEAT_SECONDS


def clean_output(text):
    """Make output easy to compare.

    Ignores trailing spaces on each line, Windows vs Unix line endings,
    and empty lines at the end.
    """
    if text is None:
        text = ""

    text = text.replace("\r\n", "\n")

    lines = []
    for line in text.split("\n"):
        lines.append(line.rstrip())

    return "\n".join(lines).rstrip("\n")


def outputs_match(output, expected_output):
    """True when the student's output is the task's expected output."""
    return clean_output(output) == clean_output(expected_output)


def update_run_state(student, error, output, expected_output):
    """Update the run counters after a Run.

    Returns two things:
    - run_state: the new same_error_count, wrong_output_count, last_error
    - progress:  True when the error changed (or went away), which means
                 the student is moving forward
    """
    if error is None:
        error = ""
    error = error.strip()

    last_error = student.get("last_error")
    if last_error is None:
        last_error = ""

    progress = error != last_error

    same_error_count = 0
    wrong_output_count = 0

    if error:
        # The code crashed. Count how many times in a row it is the same error.
        if error == last_error:
            same_error_count = student.get("same_error_count", 0) + 1
        else:
            same_error_count = 1
    else:
        # The code ran. Count how many times in a row the output was wrong.
        if not outputs_match(output, expected_output):
            wrong_output_count = student.get("wrong_output_count", 0) + 1

    run_state = {
        "same_error_count": same_error_count,
        "wrong_output_count": wrong_output_count,
        "last_error": error,
    }
    return run_state, progress


def find_run_cue(run_state):
    """Return the cue a Run triggers, or None."""
    if run_state["same_error_count"] >= RULES["same_error_runs"]:
        return "same_error"

    if run_state["wrong_output_count"] >= RULES["wrong_output_runs"]:
        return "wrong_output"

    return None


def update_activity(student, activity):
    """Add this heartbeat's key counts to the student's recent list.

    Only the last few heartbeats are kept (the churn window).
    """
    new_entry = {
        "keys_typed": activity.get("keys_typed", 0),
        "keys_deleted": activity.get("keys_deleted", 0),
    }

    recent_activity = student.get("recent_activity", [])
    recent_activity.append(new_entry)

    # Keep only the newest heartbeats.
    recent_activity = recent_activity[-CHURN_HEARTBEATS:]
    return recent_activity


def is_idle(activity):
    """True when the student has not typed AND not moved the cursor."""
    seconds_since_key = activity.get("seconds_since_last_key", 0)
    seconds_since_cursor = activity.get("seconds_since_cursor_move", 0)
    idle_limit = RULES["idle_seconds"]

    if seconds_since_key >= idle_limit and seconds_since_cursor >= idle_limit:
        return True
    return False


def is_churning(recent_activity):
    """True when the student types and deletes a lot (last 3 heartbeats).

    Stuck when deleted / typed is 0.7 or more,
    and typed + deleted is at least 20 keys.
    """
    total_typed = 0
    total_deleted = 0
    for entry in recent_activity:
        total_typed = total_typed + entry["keys_typed"]
        total_deleted = total_deleted + entry["keys_deleted"]

    total_keys = total_typed + total_deleted
    if total_keys < RULES["churn_min_keys"]:
        return False

    # Only deleting, no typing at all: that counts as churn too.
    if total_typed == 0:
        return True

    delete_ratio = total_deleted / total_typed
    return delete_ratio >= RULES["churn_delete_ratio"]


def find_heartbeat_cue(activity, recent_activity):
    """Return the cue a heartbeat triggers, or None."""
    if is_idle(activity):
        return "idle"

    if is_churning(recent_activity):
        return "churn"

    return None


def in_cooldown(student, now):
    """True when the student got a hint less than 45 seconds ago."""
    last_hint_at = student.get("last_hint_at")
    if last_hint_at is None:
        return False

    # MongoDB gives back dates without a time zone, but they are UTC.
    if last_hint_at.tzinfo is None:
        last_hint_at = last_hint_at.replace(tzinfo=timezone.utc)

    seconds_since_hint = (now - last_hint_at).total_seconds()
    return seconds_since_hint < RULES["hint_cooldown_seconds"]
