"""Fill MongoDB with a demo class, then move the bot ships around.

Run it with:  python seed_demo.py
Re-running it is how we reset class c1 before a demo.
It seeds class c1, 3 tasks, and 8 students, then keeps changing
the bot students (s2 to s8) every few seconds until you press Ctrl+C.
s1 is the live student and is never touched by the simulator.
"""

import random
import time
from datetime import datetime, timezone

from db import students, tasks, snapshots, hints, classes

CLASS_ID = "c1"
LIVE_STUDENT_ID = "s1"
SIMULATOR_SECONDS = 10

# Copy of the 13 concept labels in athena/prompts.py (Person B).
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
    "other",
]

# Short stuck reason the teacher sees for each Argus cue.
CUE_REASONS = {
    "idle": "No typing for 60 seconds",
    "churn": "Typing and deleting a lot",
    "same_error": "Same error 3 times",
    "wrong_output": "Output is wrong 3 times",
}

DEMO_TASKS = [
    {
        "_id": "t1",
        "title": "Say hello to Ithaca",
        "instructions": "Use print to show: Hello, Ithaca!",
        "expected_output": "Hello, Ithaca!",
    },
    {
        "_id": "t2",
        "title": "Count the oars",
        "instructions": "Use a for loop to print the numbers 1 to 5, "
                        "one on each line.",
        "expected_output": "1\n2\n3\n4\n5",
    },
    {
        "_id": "t3",
        "title": "Is the ship ready?",
        "instructions": "Make a variable crew = 6. If crew is 5 or more, "
                        "print: Set sail!",
        "expected_output": "Set sail!",
    },
]


def make_student(student_id, name, status, cue, concept, hint_level,
                 minutes_stuck):
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
        "current_task_id": "t1",
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

    # s1 is the live student. The bots start in a mix of statuses
    # so the Sea Map looks like a real class right away.
    demo_students = [
        make_student("s1", "Maya", "green", None, None, 0, 0),
        make_student("s2", "Leo", "green", None, None, 0, 0),
        make_student("s3", "Ava", "yellow", "same_error",
                     "missing colon", 1, 1),
        make_student("s4", "Noah", "yellow", "idle",
                     "indentation", 2, 2),
        make_student("s5", "Zoe", "red", "wrong_output",
                     "loop runs wrong number of times", 3, 4),
        make_student("s6", "Sam", "ithaca", None, None, 0, 0),
        make_student("s7", "Ivy", "green", None, None, 0, 0),
        make_student("s8", "Ben", "green", None, None, 0, 0),
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
