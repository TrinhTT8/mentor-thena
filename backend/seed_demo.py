"""Fill MongoDB with a demo class, then move the bot ships around.

Run it with:  python seed_demo.py
Re-running it is how we reset class c1 before a demo.
It seeds class c1, 4 tasks, and 8 students, then keeps changing
the bot students (s2 to s8) every few seconds until you press Ctrl+C.
s1 is the live student and is never touched by the simulator.
"""

import random
import time
from datetime import datetime, timezone

from argus import watcher
from db import students, tasks, snapshots, hints, classes

CLASS_ID = "c1"
LIVE_STUDENT_ID = "s1"
SIMULATOR_SECONDS = 10

# Copy of the 15 concept labels in athena/prompts.py (Person B).
# Keep this list in sync with that file.
CONCEPTS = [
    "missing colon",
    "indentation",
    "misspelled name",
    "missing quotes",
    "unclosed bracket",
    "text and number mix-up",
    "infinite loop",
    "loop runs wrong number of times",
    "equals vs double equals",
    "condition backwards",
    "return vs print",
    "wrong output",
    "getting started",
    "next step",
    "other",
]

# Short stuck reason the teacher sees for each Argus cue.
# Built from config.STUCK_RULES, so it always matches the real rules.
CUE_REASONS = watcher.cue_reasons()

# The demo quests. Each one shows a different demo bug.
# Sent to the browser: title, instructions, example (see seamap/dashboard.py).
# Server only (never sent):
# - expected_output: the server compares it to decide Ithaca
# - solution: the correct program; Siren Guard blocks hints that show it
# - steps: the teacher's plan; Athena uses it to pick the next small step
# example is a teacher-written sample for a DIFFERENT problem,
# never the expected output.
DEMO_TASKS = [
    {
        # Demo bug: missing quotes.
        "_id": "t1",
        "title": "Say hello to Ithaca",
        "instructions": "Use print to show: Hello, Ithaca!",
        "example": 'print("Ahoy, sailor!")',
        "expected_output": "Hello, Ithaca!",
        "solution": 'print("Hello, Ithaca!")',
        "steps": [
            "write print with round brackets",
            "put the words inside quote marks",
        ],
    },
    {
        # Demo bugs: missing colon, indentation.
        "_id": "t2",
        "title": "Big kid",
        "instructions": "Make age = 10. If age is more than 8, print: Big kid",
        "example": 'pet = "cat"\nif pet == "cat":\n    print("Meow!")',
        "expected_output": "Big kid",
        "solution": 'age = 10\nif age > 8:\n    print("Big kid")',
        "steps": [
            "make the age variable",
            "write an if that checks if age is more than 8",
            "print inside the if (push the line in)",
        ],
    },
    {
        # Demo bug: infinite loop (forgetting to make n smaller).
        "_id": "t3",
        "title": "Countdown to sail",
        "instructions": "Make n = 3. Use a while loop to print 3, 2, 1 "
                        "(one on each line), then print: Set sail!",
        "example": 'snacks = 1\nwhile snacks <= 2:\n    print("Yum")\n'
                   '    snacks = snacks + 1',
        "expected_output": "3\n2\n1\nSet sail!",
        "solution": 'n = 3\nwhile n > 0:\n    print(n)\n    n = n - 1\n'
                    'print("Set sail!")',
        "steps": [
            "make n = 3",
            "write a while loop that runs while n is more than 0",
            "print n inside the loop",
            "make n smaller each time",
            "after the loop, print Set sail!",
        ],
    },
    {
        # Demo concept: getting started (kids who don't know how to begin).
        "_id": "t4",
        "title": "Odd or even crew",
        "instructions": "Make crew = 7. If crew is even, print: even. "
                        "Otherwise print: odd",
        "example": "cookies = 10\n"
                   "# what is left over after sharing with 3 friends?\n"
                   "print(cookies % 3)",
        "expected_output": "odd",
        "solution": 'crew = 7\nif crew % 2 == 0:\n    print("even")\n'
                    'else:\n    print("odd")',
        "steps": [
            "find the leftover after dividing by 2",
            "use if and else",
            "print the word",
        ],
    },
]


def make_student(student_id, name, task_id, status, cue, concept,
                 hint_level, minutes_stuck):
    """Build one student document for class c1."""
    now = datetime.now(timezone.utc)

    stuck_reason = None
    stuck_since = None
    if status == "yellow" or status == "red":
        stuck_reason = CUE_REASONS[cue]
        stuck_since = datetime.fromtimestamp(
            now.timestamp() - minutes_stuck * 60,
            tz=timezone.utc,
        )

    student = {
        "_id": student_id,
        "name": name,
        "class_id": CLASS_ID,
        "status": status,
        "stuck_reason": stuck_reason,
        "concept": concept,
        "hint_level": hint_level,
        "current_task_id": task_id,
        # Argus state fields
        "same_error_count": 0,
        "wrong_output_count": 0,
        "last_error": None,
        "last_hint_at": None,
        "stuck_since": stuck_since,
    }
    return student


def clear_old_data():
    """Delete class c1's students and their snapshots and hints."""
    student_ids = []
    for student in students.find({"class_id": CLASS_ID}, {"_id": 1}):
        student_ids.append(student["_id"])

    snapshots.delete_many({"student_id": {"$in": student_ids}})
    hints.delete_many({"student_id": {"$in": student_ids}})
    students.delete_many({"class_id": CLASS_ID})

    print(f"Cleared {len(student_ids)} old students in {CLASS_ID}.")


def seed():
    """Create class c1, its tasks, and 8 students."""
    clear_old_data()

    demo_class = {
        "_id": CLASS_ID,
        "name": "Room 7 Coders",
        "teacher_name": "Ms. Rivera",
        "latest_insight": None,
    }
    # Replace the class if it is already there, or create it.
    classes.replace_one({"_id": CLASS_ID}, demo_class, upsert=True)

    for task in DEMO_TASKS:
        tasks.replace_one({"_id": task["_id"]}, task, upsert=True)

    # s1 is the live student, on Big kid (the missing colon demo bug).
    # The bots are spread over all 4 quests, in a mix of statuses,
    # so the Sea Map looks like a real class right away.
    demo_students = [
        make_student("s1", "Maya", "t2", "green", None, None, 0, 0),
        make_student("s2", "Leo", "t1", "green", None, None, 0, 0),
        make_student("s3", "Ava", "t2", "yellow", "same_error",
                     "missing colon", 1, 1),
        make_student("s4", "Noah", "t2", "yellow", "idle",
                     "indentation", 2, 2),
        make_student("s5", "Zoe", "t3", "red", "same_error",
                     "infinite loop", 3, 4),
        make_student("s6", "Sam", "t1", "ithaca", None, None, 0, 0),
        make_student("s7", "Ivy", "t4", "green", None, None, 0, 0),
        make_student("s8", "Ben", "t4", "yellow", "idle",
                     "getting started", 1, 1),
    ]
    students.insert_many(demo_students)

    print(f"Seeded {CLASS_ID}: {len(DEMO_TASKS)} tasks, "
          f"{len(demo_students)} students.")


def set_green(student_id):
    """Put a bot back to sailing fine."""
    students.update_one(
        {"_id": student_id},
        {"$set": {
            "status": "green",
            "stuck_reason": None,
            "concept": None,
            "hint_level": 0,
            "stuck_since": None,
        }},
    )


def move_bot(bot):
    """Move one bot ship one step, like a real student would."""
    status = bot["status"]
    bot_id = bot["_id"]

    if status == "green":
        # Most of the time a green bot gets stuck.
        # Sometimes it finishes the task instead.
        if random.random() < 0.2:
            students.update_one(
                {"_id": bot_id},
                {"$set": {"status": "ithaca"}},
            )
            return "ithaca"

        cue = random.choice(list(CUE_REASONS.keys()))
        concept = random.choice(CONCEPTS)
        students.update_one(
            {"_id": bot_id},
            {"$set": {
                "status": "yellow",
                "stuck_reason": CUE_REASONS[cue],
                "concept": concept,
                "hint_level": 1,
                "stuck_since": datetime.now(timezone.utc),
            }},
        )
        return f"yellow ({concept})"

    if status == "yellow":
        # Half the time the hint helps and the bot fixes its bug.
        if random.random() < 0.5:
            set_green(bot_id)
            return "green (fixed it)"

        new_level = bot.get("hint_level", 1) + 1
        if new_level >= 3:
            students.update_one(
                {"_id": bot_id},
                {"$set": {"status": "red", "hint_level": 3}},
            )
            return "red (needs the teacher)"

        students.update_one(
            {"_id": bot_id},
            {"$set": {"hint_level": new_level}},
        )
        return f"yellow (hint level {new_level})"

    if status == "red":
        # Pretend the teacher came over and helped.
        set_green(bot_id)
        return "green (teacher helped)"

    # A ship at Ithaca stays docked.
    return None


def simulate():
    """Every few seconds, move one random bot. Stops on Ctrl+C."""
    print(f"Simulating bots every {SIMULATOR_SECONDS} s. "
          "Press Ctrl+C to stop.")

    try:
        while True:
            time.sleep(SIMULATOR_SECONDS)

            bot_query = {
                "class_id": CLASS_ID,
                "_id": {"$ne": LIVE_STUDENT_ID},
                "status": {"$ne": "ithaca"},
            }
            bots = list(students.find(bot_query))
            if len(bots) == 0:
                print("All bots reached Ithaca.")
                continue

            bot = random.choice(bots)
            change = move_bot(bot)
            print(f"{bot['_id']} {bot['name']}: {change}")
    except KeyboardInterrupt:
        print("Simulator stopped.")


if __name__ == "__main__":
    seed()
    simulate()
