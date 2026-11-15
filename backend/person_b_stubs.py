"""STUB versions of Person B's functions (Athena, Ship's Log, Tiresias tip).

The names, inputs, and return shapes follow the team CLAUDE.md section
"Function contracts between Person A and Person B".
When Person B's real code is ready, swap the imports to their modules
and delete this file.
"""

# Short stuck reason for each Argus cue (used only by the stub).
FAKE_REASONS = {
    "idle": "No typing for 60 seconds",
    "churn": "Typing and deleting a lot",
    "same_error": "Same error 3 times",
    "wrong_output": "Output is wrong 3 times",
}


# STUB
# TODO: swap for Person B's real function (athena/hint_giver.py)
def get_hint(student, task, snapshot, level, cue, past_hints=None):
    """Return a fake hint in the exact contract shape. Never raises."""
    # The contract says level is kept between 1 and 3.
    if level < 1:
        level = 1
    if level > 3:
        level = 3

    reason = FAKE_REASONS.get(cue, "Stuck")

    fake_hint = {
        "text": "What does Python need at the end of an if line?",
        "reason": reason,
        "concept": "missing colon",
        "level": level,
        "from_ships_log": False,
        "siren_blocked": False,
        "source": "fallback",
    }
    return fake_hint


# STUB
# TODO: swap for Person B's real function (ships_log/memory.py)
def save_helpful(hint, snapshot):
    """Pretend to save a hint that helped. Returns None, like the contract."""
    return None


# STUB
# TODO: swap for Person B's real function (tiresias/insights.py)
def write_tip(counts):
    """Return a fake teacher tip as text.

    counts is a list like [{"concept": "missing colon", "students": 2}].
    """
    if len(counts) == 0:
        return "Everyone is sailing fine right now."

    # Use the first concept in the list for the fake tip.
    top = counts[0]
    if top["students"] == 1:
        stuck_text = f"1 student is stuck on {top['concept']}."
    else:
        stuck_text = f"{top['students']} students are stuck on {top['concept']}."

    tip = stuck_text + " Try a 1-minute mini lesson."
    return tip
