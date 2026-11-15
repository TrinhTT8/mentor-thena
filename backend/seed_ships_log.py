"""Give the Ship's Log a starting memory before the demo.

Run it with:  python seed_ships_log.py   (needs USE_GEMINI=1 in .env)

It saves about 15 common kid bugs, each with a hint that "helped", the same
way ships_log/memory.py save_helpful() saves a real one. Then the demo can
show hints with "from_ships_log": true before any real student has been helped.

Each new entry costs 1 embedding request (from the 1,000/day embedding limit).
Bugs already in the log are skipped, so running it again costs nothing.
Demo reset and seed_demo.py keep these entries.
"""

from datetime import datetime, timezone

import config
from db import ship_log
from ships_log.memory import bug_text, short_error
from gemini_client import embed

# (error message, hint that helped). The concept is worked out from the
# error by detect_concept(), exactly like a real search, so they match.
# Hints are written like level 1 hints: no symbol, no line number.
SEED_BUGS = [
    (
        "SyntaxError: expected ':'",
        "Lines that start with if, for or while need something special at "
        "the very end. Can you spot what's missing?",
    ),
    (
        "IndentationError: expected an indented block after 'if' statement "
        "on line 2",
        "Python wants the lines inside an if to be pushed in. Do your lines "
        "line up the way you want?",
    ),
    (
        "IndentationError: unexpected indent",
        "One of your lines starts further in than Python expects. Which line "
        "looks pushed in by itself?",
    ),
    (
        "IndentationError: unindent does not match any outer indentation level",
        "Some lines are pushed in by different amounts. Do the lines inside "
        "your block all start at the same place?",
    ),
    (
        "NameError: name 'snak' is not defined",
        "Python can't find one of your names. Is it spelled exactly the same "
        "everywhere you use it?",
    ),
    (
        "NameError: name 'Print' is not defined. Did you mean: 'print'?",
        "Python cares about big and small letters. Does every word look "
        "exactly like the one Python knows?",
    ),
    (
        "SyntaxError: unterminated string literal (detected at line 1)",
        "Words in Python need a mark at the start and at the end. Does your "
        "text have both?",
    ),
    (
        "SyntaxError: '(' was never closed",
        "Every bracket that opens needs one that closes. Can you count them "
        "on your line?",
    ),
    (
        "SyntaxError: unmatched ')'",
        "There's a closing bracket with no partner. Can you find the extra one?",
    ),
    (
        'TypeError: can only concatenate str (not "int") to str',
        "Python is trying to join words and a number. Can it glue those two "
        "kinds together as they are?",
    ),
    (
        "TypeError: unsupported operand type(s) for +: 'int' and 'str'",
        "One side is a number and the other is words. How could you make "
        "them the same kind?",
    ),
    (
        "TimeoutError: the code ran too long",
        "Your loop keeps going and going. What inside it changes so it "
        "can stop?",
    ),
    (
        "SyntaxError: 'return' outside function",
        "That word only works inside a function. Is your line inside one?",
    ),
    (
        "SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead "
        "of '='?",
        "Python has one sign to store a value and a different one to compare. "
        "Which one does your if need?",
    ),
    (
        "SyntaxError: cannot assign to expression here. Maybe you meant '==' "
        "instead of '='?",
        "It looks like you're storing a value where you meant to ask a "
        "question. What does your if want to check?",
    ),
]


def seed_ships_log():
    """Save the seed bugs that are not in the log yet. Returns (added, skipped)."""
    added = 0
    skipped = 0

    for error, hint in SEED_BUGS:
        text = bug_text(error)

        # Already in the log (from an earlier run): no request needed.
        if ship_log.find_one({"bug_text": text}) is not None:
            skipped = skipped + 1
            continue

        concept = text.split(" | ")[0]
        ship_log.insert_one({
            "error": short_error(error),
            "code_summary": "",
            "concept": concept,
            "bug_text": text,
            "hint_text": hint,
            "embedding": embed(text),
            "times_helped": 1,
            "seeded": True,
            "created_at": datetime.now(timezone.utc),
        })
        added = added + 1
        print(f"  added: {text}")

    return added, skipped


if __name__ == "__main__":
    if not config.USE_GEMINI:
        print("USE_GEMINI=0 in .env, so nothing was seeded (0 requests).")
        print("Set USE_GEMINI=1 in .env to seed the Ship's Log.")
    else:
        added, skipped = seed_ships_log()
        print(f"Ship's Log: added {added}, skipped {skipped} already there.")
        print(f"Embedding requests used: {added}")
        print(f"Entries in the log now: {ship_log.count_documents({})}")
