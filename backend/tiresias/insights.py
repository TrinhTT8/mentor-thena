"""Tiresias: turn the class's stuck counts into one short tip for the teacher.

class_counts.py counts the stuck students and calls write_tip(counts).
The biggest problem gets a 1-minute mini lesson idea. The other problems
are listed after it, so the teacher can scan them.

Written by Person A (agreed with Person B).
"""

import logging

from pydantic import BaseModel

import config
from athena.prompts import CONCEPTS
from gemini_client import generate_json

log = logging.getLogger(__name__)

CALM_SEA_TIP = "Everyone is sailing fine right now."

# One ready-made 1-minute mini lesson idea for each concept.
# Used when Gemini is switched off (USE_GEMINI=0) or fails.
MINI_LESSONS = {
    "missing colon":
        "Write one if line on the board and circle the colon at the end.",
    "indentation":
        "Show an if with two lines inside it, and trace the pushed-in "
        "lines with your finger.",
    "misspelled name":
        "Make a variable on the board, then misspell it once and ask the "
        "class to spot the difference.",
    "missing quotes":
        "Write print(hello) and print(\"hello\") side by side and ask which "
        "one is text.",
    "unclosed bracket":
        "Have the class count the opening and closing brackets in one line "
        "out loud.",
    "text and number mix-up":
        "Show \"Age: \" + 9 failing, then ask how to turn the number "
        "into text.",
    "infinite loop":
        "Act out a while loop: what has to change each time so the "
        "loop can stop?",
    "loop runs wrong number of times":
        "Run range(5) together and count the numbers it gives on "
        "your fingers.",
    "equals vs double equals":
        "Put x = 3 next to x == 3 and ask: which one stores, "
        "which one asks?",
    "condition backwards":
        "Read an if line out loud as a sentence and ask if it says what "
        "we mean.",
    "return vs print":
        "Show a function that prints and one that returns, then use both "
        "answers in a sum.",
    "wrong output":
        "Put the expected output next to one student's output and ask "
        "the class to spot the difference.",
    "getting started":
        "Read the task out loud together and ask: what is the very first "
        "line we need to write?",
    "next step":
        "Ask the class: what does our program show now, and what is "
        "still missing from the answer?",
    "other":
        "Ask one student to read their code out loud, line by line, "
        "to the class.",
}

# Safety check: the ideas above must cover exactly the concepts
# in athena/prompts.py (15 since Person B added "getting started"
# and "next step").
assert set(MINI_LESSONS) == set(CONCEPTS), "MINI_LESSONS and CONCEPTS are out of sync"

TIP_SYSTEM_PROMPT = """You are Tiresias, a wise helper for a teacher of children aged 8 to 10 who are learning Python.
Give the teacher ONE concrete mini lesson idea that takes about 1 minute in front of the whole class.

Rules:
- At most 2 short sentences.
- Talk to the teacher, not to the children.
- Do not use student names.
- Do not write the fixed code for any student.
- Do not use emoji."""


# The blank form Gemini must fill in.
class TipResult(BaseModel):
    mini_lesson: str


def students_text(count):
    """'1 student is' or '3 students are'."""
    if count == 1:
        return "1 student is"
    return f"{count} students are"


def build_tip_prompt(concept, count):
    """The message for Gemini about the biggest problem in the class."""
    meaning = CONCEPTS.get(concept, "")
    prompt = (
        f"{students_text(count)} stuck on: {concept}.\n"
        f"What that means: {meaning}\n"
        "Suggest one 1-minute mini lesson for the whole class."
    )
    return prompt


def mini_lesson_for(concept, count):
    """A mini lesson idea for one concept, from Gemini or the ready-made list."""
    ready_made = MINI_LESSONS.get(concept, MINI_LESSONS["other"])

    # Switched off in .env: save the daily Gemini budget.
    if not config.USE_GEMINI:
        return ready_made

    try:
        prompt = build_tip_prompt(concept, count)
        result = generate_json(prompt, TipResult, system=TIP_SYSTEM_PROMPT)
        return result.mini_lesson.strip()
    except Exception as error:
        # Timeout, rate limit, Gemini down, bad JSON: never crash.
        log.warning("Gemini tip failed for %s: %s", concept, error)
        return ready_made


def write_tip(counts):
    """Return one short tip for the teacher. Never raises.

    counts is a list like [{"concept": "missing colon", "students": 3}],
    biggest group first.
    """
    if len(counts) == 0:
        return CALM_SEA_TIP

    # The biggest problem gets a mini lesson idea.
    top = counts[0]
    concept = top["concept"]
    count = top["students"]

    tip = f"{students_text(count)} stuck on {concept}. "
    tip = tip + mini_lesson_for(concept, count)

    # The other problems are just listed, so the teacher can scan them.
    others = []
    for row in counts[1:]:
        others.append(f"{row['concept']} ({row['students']})")

    if len(others) > 0:
        tip = tip + " Also stuck: " + ", ".join(others) + "."

    return tip
