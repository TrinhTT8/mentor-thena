"""MentorThena Flask API. Returns JSON only; React handles all pages."""

from datetime import datetime, timezone

from flask import Flask, jsonify, request

import config
from db import students, tasks, hints, classes

app = Flask(__name__)


def to_iso(value):
    """Turn a date into an ISO 8601 text, like 2026-11-14T03:20:00+00:00.

    MongoDB gives back dates without a time zone, but they are always UTC.
    Anything that is not a date (for example None) is returned as it is.
    """
    if not isinstance(value, datetime):
        return value

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    return value.isoformat()


def find_latest_hint(student_id):
    """Return the newest hint for a student in the contract shape, or None."""
    hint_doc = hints.find_one(
        {"student_id": student_id},
        sort=[("created_at", -1)],
    )

    if hint_doc is None:
        return None

    hint = {
        "level": hint_doc.get("level"),
        "text": hint_doc.get("text"),
        "from_ships_log": hint_doc.get("from_ships_log", False),
    }
    return hint


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.get("/api/task/<student_id>")
def get_task(student_id):
    """Send the student's current task. Never sends expected_output."""
    student = students.find_one({"_id": student_id})

    task = None
    if student is not None:
        task_id = student.get("current_task_id")
        # Only ask MongoDB for the fields we are allowed to send.
        task = tasks.find_one(
            {"_id": task_id},
            {"title": 1, "instructions": 1},
        )

    if task is not None:
        result = {
            "task_id": task["_id"],
            "title": task.get("title"),
            "instructions": task.get("instructions"),
        }
        return jsonify(result)

    # STUB: fake task until seed_demo.py fills the database.
    fake_task = {
        "task_id": "t1",
        "title": "Say hello to Ithaca",
        "instructions": "Use print to show: Hello, Ithaca!",
    }
    return jsonify(fake_task)


@app.post("/api/snapshot")
def post_snapshot():
    """Receive code from the student (on Run or heartbeat)."""
    data = request.get_json(silent=True)
    if data is None:
        data = {}

    student_id = data.get("student_id")
    if not student_id:
        return jsonify({"error": "student_id is required"}), 400

    # STUB: nothing is saved yet and Argus does not run yet (Task 3).
    # A "run" returns a fake level 1 hint so the frontend can test
    # the hint bubble. A "heartbeat" returns no hint.
    event = data.get("event")

    if event == "run":
        fake_hint = {
            "level": 1,
            "text": "What does Python need at the end of an if line?",
            "from_ships_log": False,
        }
        return jsonify({"status": "yellow", "hint": fake_hint})

    return jsonify({"status": "green", "hint": None})


@app.get("/api/status/<student_id>")
def get_status(student_id):
    """Send the student's own ship color and their latest hint."""
    student = students.find_one({"_id": student_id})

    if student is not None:
        result = {
            "status": student.get("status", "green"),
            "hint": find_latest_hint(student_id),
        }
        return jsonify(result)

    # STUB: fake status until seed_demo.py fills the database.
    fake_hint = {
        "level": 1,
        "text": "What does Python need at the end of an if line?",
        "from_ships_log": False,
    }
    return jsonify({"status": "yellow", "hint": fake_hint})


@app.get("/api/seamap/<class_id>")
def get_seamap(class_id):
    """Send every ship in the class for the teacher's Sea Map."""
    student_list = []

    for student in students.find({"class_id": class_id}):
        ship = {
            "id": student["_id"],
            "name": student.get("name"),
            "status": student.get("status", "green"),
            "reason": student.get("stuck_reason"),
            "concept": student.get("concept"),
            "hint_level": student.get("hint_level", 0),
            "stuck_since": to_iso(student.get("stuck_since")),
        }
        student_list.append(ship)

    if len(student_list) == 0:
        # STUB: fake class until seed_demo.py fills the database.
        student_list = make_fake_ships()

    # STUB: real numbers come in Task 5 (seamap/dashboard.py).
    fake_stats = {
        "avg_seconds_stuck": 95,
        "siren_blocks": 2,
    }

    result = {
        "class_id": class_id,
        "students": student_list,
        "stats": fake_stats,
    }
    return jsonify(result)


def make_fake_ships():
    """STUB: 8 fake ships that show every status on the Sea Map."""
    stuck_time = "2026-11-14T03:20:00+00:00"

    fake_ships = [
        {
            "id": "s1", "name": "Maya", "status": "green",
            "reason": None, "concept": None,
            "hint_level": 0, "stuck_since": None,
        },
        {
            "id": "s2", "name": "Leo", "status": "green",
            "reason": None, "concept": None,
            "hint_level": 0, "stuck_since": None,
        },
        {
            "id": "s3", "name": "Ava", "status": "yellow",
            "reason": "Same error 3 times",
            "concept": "missing colon",
            "hint_level": 1, "stuck_since": stuck_time,
        },
        {
            "id": "s4", "name": "Noah", "status": "yellow",
            "reason": "No typing for 60 seconds",
            "concept": "indentation",
            "hint_level": 2, "stuck_since": stuck_time,
        },
        {
            "id": "s5", "name": "Zoe", "status": "red",
            "reason": "Still stuck after 3 hints",
            "concept": "missing colon",
            "hint_level": 3, "stuck_since": stuck_time,
        },
        {
            "id": "s6", "name": "Sam", "status": "ithaca",
            "reason": None, "concept": None,
            "hint_level": 0, "stuck_since": None,
        },
        {
            "id": "s7", "name": "Ivy", "status": "green",
            "reason": None, "concept": None,
            "hint_level": 0, "stuck_since": None,
        },
        {
            "id": "s8", "name": "Ben", "status": "yellow",
            "reason": "Output is wrong 3 times",
            "concept": "typo in print",
            "hint_level": 1, "stuck_since": stuck_time,
        },
    ]
    return fake_ships


@app.get("/api/insight/<class_id>")
def get_insight(class_id):
    """Send the Tiresias tip for the teacher."""
    class_doc = classes.find_one({"_id": class_id})

    insight = None
    if class_doc is not None:
        insight = class_doc.get("latest_insight")

    if insight is not None:
        result = {
            "tip": insight.get("tip"),
            "counts": insight.get("counts", []),
            "updated_at": to_iso(insight.get("updated_at")),
        }
        return jsonify(result)

    # STUB: fake tip until Tiresias is built (Task 6).
    fake_insight = {
        "tip": "2 students are stuck on missing colons. "
               "Try a 1-minute mini lesson on if lines.",
        "counts": [
            {"concept": "missing colon", "students": 2},
            {"concept": "indentation", "students": 1},
            {"concept": "typo in print", "students": 1},
        ],
        "updated_at": to_iso(datetime.now(timezone.utc)),
    }
    return jsonify(fake_insight)


@app.post("/api/resolve/<student_id>")
def resolve_student(student_id):
    """Teacher marks a student as helped."""
    # STUB: nothing is written to MongoDB yet (Task 5).
    return jsonify({"ok": True, "status": "green"})


@app.post("/api/demo/reset")
def demo_reset():
    """Reset every ship before a demo run."""
    # STUB: nothing is reset yet. The response shape is not in the
    # contract yet, so this only returns ok.
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(port=config.PORT, debug=True)
