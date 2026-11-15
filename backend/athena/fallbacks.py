"""Backup hints for when Gemini is slow or down.

detect_concept() reads Python's error message (no AI) to guess the concept,
then FALLBACK_HINTS gives a hand-written hint for that concept and level.
"""

import re

from athena.prompts import CONCEPTS

# Each rule: (pattern to look for in the error message, concept). The first match wins, so order matters.
ERROR_RULES = [
    (r"TimeoutError|ran too long", "infinite loop"),
    (r"expected ':'", "missing colon"),
    (r"IndentationError|expected an indented block|unexpected indent|unindent", "indentation"),
    (r"NameError", "misspelled name"),
    (r"unterminated string|EOL while scanning|unterminated triple", "missing quotes"),
    (r"was never closed|unmatched|does not match opening", "unclosed bracket"),
    (r"can only concatenate str|unsupported operand type\(s\) for \+", "text and number mix-up"),
    (r"'return' outside function", "return vs print"),
    (r"Maybe you meant '==' |cannot assign to", "equals vs double equals"),
]


def _unquoted_text(code, error, expected_output):
    """True when a print( holds words from the task's answer with no quotes around them.

    print(Hello, Ithaca!) makes Python say "invalid syntax" or "NameError: name 'Hello'",
    and neither message mentions quotes, so we look at the code itself.
    """
    if not code or not expected_output:
        return False
    if not re.search(r"SyntaxError: invalid syntax|NameError", error):
        return False
    answer_words = set(re.findall(r"[a-z]{2,}", expected_output.lower()))
    for inside in re.findall(r"print\(([^)\n]*)", code):
        if '"' in inside or "'" in inside:
            continue  # this print already uses quotes
        for word in re.findall(r"[A-Za-z_]\w*", inside):
            made_as_variable = re.search(rf"^\s*{word}\s*=", code, re.M)
            if word.lower() in answer_words and not made_as_variable:
                return True
    return False


def detect_concept(error="", output="", expected_output="", code=""):
    """Guess the concept from the error message, or from the output when there is no error."""
    if _unquoted_text(code, error, expected_output):
        return "missing quotes"
    for pattern, concept in ERROR_RULES:
        if error and re.search(pattern, error):
            return concept
    if error:
        return "other"
    if not _code_lines(code):
        return "getting started"  # nothing written yet (comments don't count)
    got, want = _clean(output), _clean(expected_output)
    if want and got != want:
        if "None" in got.split() and "None" not in want:
            return "return vs print"  # a function forgot to return, so Python printed None
        if not got or want.startswith(got):
            return "next step"  # nothing printed yet, or only the first part of the answer
        return "wrong output"
    return "other"


def _code_lines(code):
    """The lines that do something: not blank, not a # comment."""
    return [line for line in (code or "").splitlines() if line.strip() and not line.strip().startswith("#")]


def _clean(text):
    """Ignore trailing spaces and line endings, as the Ithaca check does."""
    return "\n".join(line.rstrip() for line in (text or "").strip().splitlines())


# Hand-written hints: level 1 = nudge, 2 = where to look, 3 = tiny example that is not their code.
FALLBACK_HINTS = {
    "missing colon": [
        "Python lines that start with if, for or while need something special at the end. Can you spot it?",
        "Look at the very end of your if, for or while line. Is anything missing there?",
        "A line like if pet == \"cat\": ends with a colon. Does your line end the same way?",
    ],
    "indentation": [
        "Python cares about spaces at the start of a line. Do your lines line up the way you want?",
        "Look at the lines just under your if, for or def. Are they pushed in?",
        "Lines inside an if are pushed in, like:\nif hungry:\n    eat()\nAre yours pushed in the same way?",
    ],
    "misspelled name": [
        "Python can't find one of your names. Is every name spelled the same each time?",
        "Look at the name in the error message. Find where you first made it. Do they match exactly?",
        "If you make snack = 5 and later write snak, Python is confused. Check your names letter by letter.",
    ],
    "missing quotes": [
        "Text in Python needs something around it. Does all your text have that?",
        "Look at your print line. Does the text start AND end with quote marks?",
        "Text is wrapped in quotes on both sides, like \"hello\". Does your text have both?",
    ],
    "unclosed bracket": [
        "Every ( that opens needs a ) that closes. Can you count them?",
        "Look at the line in the error. Count the ( and the ). Are they the same number?",
        "print(\"hi\") opens one ( and closes one ). Does your line open and close the same number?",
    ],
    "text and number mix-up": [
        "Python is mixing words and numbers. Can it add them together?",
        "Look at the line where you use +. Is one side text and the other a number?",
        "To join a number to text, turn it into text first, like \"Age: \" + str(9).",
    ],
    "infinite loop": [
        "Your code kept running and running. What tells your loop when to stop?",
        "Look at your while line. Does something inside the loop change so it can stop?",
        "In a loop like while cookies > 0: you need cookies = cookies - 1 inside, or it never ends.",
    ],
    "loop runs wrong number of times": [
        "Your loop runs, but how many times? Try counting them.",
        "Look at the numbers in your range(). Where does it start, and where does it stop?",
        "range(1, 4) gives 1, 2, 3. It stops BEFORE the last number. How many does yours give?",
    ],
    "equals vs double equals": [
        "Python has two kinds of equals. Which one are you using here?",
        "Look at your if line. Are you comparing two things or storing one?",
        "= stores a value (x = 5). == compares (if x == 5:). Which does your if line need?",
    ],
    "condition backwards": [
        "Your if is asking a question. Is it asking the right one?",
        "Look at the comparison in your if or while line. Which way should the sign point?",
        "age > 8 means bigger than 8. age < 8 means smaller. Which one does your task want?",
    ],
    "return vs print": [
        "Your function does some work. How does it give the answer back?",
        "Look at the end of your function. Does it hand back its answer?",
        "A function hands back an answer with return, like return total. Showing it with print is different.",
    ],
    "wrong output": [
        "Your code runs. Does what it shows match what the task asks for?",
        "Read the task again, then read your output. Which part is different?",
        "Compare your output with the task, letter by letter and space by space. Spot the difference?",
    ],
    "getting started": [
        "Let's read the task together. What is the very first thing your program needs to do?",
        "Look at the first part of the task. Which Python tool from class could do just that part?",
        "Every program starts small, like print(\"Ahoy!\") to show one word. Can you write one line for the first part of your task?",
    ],
    "next step": [
        "Your code runs, nice work! What part of the task is it still missing?",
        "Read the task again and find the part your program does not do yet. That is your next step.",
        "Programs grow one small step at a time: get the data, check it, then show the answer. Which step can you add next?",
    ],
    "other": [
        "Let's read your code again slowly, one line at a time. What do you notice?",
        "Look at the line number in the message. What is happening on that line?",
        "Try reading the message out loud. Which word in it could be a clue?",
    ],
}

assert all(len(hints) == 3 for hints in FALLBACK_HINTS.values()), "each concept needs 3 levels"
assert set(FALLBACK_HINTS) == set(CONCEPTS), "FALLBACK_HINTS must cover exactly the concepts in prompts.py"


def fallback_hint(snapshot, task, level, why="Gemini unavailable"):
    """Return (text, reason, concept) without calling Gemini."""
    error = snapshot.get("error", "")
    concept = detect_concept(error, snapshot.get("output", ""), task.get("expected_output", ""),
                             snapshot.get("code", ""))
    text = FALLBACK_HINTS[concept][level - 1]
    # Python puts the useful part of an error on its LAST line ("SyntaxError: expected ':'").
    last_line = error.strip().splitlines()[-1] if error.strip() else "no error message"
    reason = f"Backup hint ({why}): {concept}. {last_line}"
    return text, reason, concept
