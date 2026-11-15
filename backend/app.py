"""MentorThena Flask API. Returns JSON only; React handles all pages."""

from datetime import datetime, timezone

from flask import Flask, jsonify, request

import config
from argus import watcher
from athena.hint_giver import get_hint
from db import students, tasks, snapshots, hints, classes
# STUB: save_helpful is still a stub until Person B writes ships_log/memory.py.
# TODO: swap for Person B's real function
from person_b_stubs import save_helpful

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
    """Receive code from the student (on Run or heartbeat).

    Steps: save the run, check Ithaca, run Argus, ask Athena for a hint
    if Argus finds a cue, then update the student.
    """
    data = request.get_json(silent=True)
    if data is None:
        data = {}

    student_id = data.get("student_id")
    if not student_id:
        return jsonify({"error": "student_id is required"}), 400

    student = students.find_one({"_id": student_id})
    if student is None:
        return jsonify({"error": "student not found"}), 404

    task_id = data.get("task_id")
    if not task_id:
        task_id = student.get("current_task_id")

    # The full task, with expected_output. It stays on the server.
    task = tasks.find_one({"_id": task_id})
    if task is None:
        task = {}

    event = data.get("event")
    now = datetime.now(timezone.utc)
    snapshot = {
        "code": data.get("code") or "",
        "output": data.get("output") or "",
        "error": data.get("error") or "",
    }

    # Save every Run. Heartbeats are not saved.
    if event == "run":
        snapshots.insert_one({
            "student_id": student_id,
            "task_id": task_id,
            "code": snapshot["code"],
            "output": snapshot["output"],
            "error": snapshot["error"],
            "created_at": now,
        })

    # A ship at Ithaca stays docked.
    status = student.get("status", "green")
    if status == "ithaca":
        return jsonify({"status": "ithaca", "hint": None})

    expected_output = task.get("expected_output", "")

    # Ithaca check: the code ran without an error and the output is right.
    if event == "run" and not snapshot["error"] and expected_output:
        if watcher.outputs_match(snapshot["output"], expected_output):
            reach_ithaca(student_id, task_id, snapshot)
            return jsonify({"status": "ithaca", "hint": None})

    # Changes to save on the student at the end.
    changes = {}
    hint_level = student.get("hint_level", 0)
    stuck_since = student.get("stuck_since")
    cue = None

    if event == "run":
        run_state, progress = watcher.update_run_state(
            student,
            snapshot["error"],
            snapshot["output"],
            expected_output,
        )
        changes.update(run_state)

        # The student is moving forward: a yellow ship goes back to green.
        # A red ship stays red until the teacher helps.
        if progress and status == "yellow":
            status = "green"
            hint_level = 0
            stuck_since = None
            changes["stuck_reason"] = None
            changes["concept"] = None

        cue = watcher.find_run_cue(run_state)

    elif event == "heartbeat":
        activity = data.get("activity")
        if activity is None:
            activity = {}

        recent_activity = watcher.update_activity(student, activity)
        changes["recent_activity"] = recent_activity

        cue = watcher.find_heartbeat_cue(activity, recent_activity)

    # Argus found a cue, and the last hint was long enough ago.
    new_hint = None
    if cue is not None and not watcher.in_cooldown(student, now):
        if hint_level >= config.MAX_HINT_LEVEL:
            # Already had the level 3 hint: the teacher is needed.
            status = "red"
        else:
            hint_level = hint_level + 1
            new_hint = make_hint(
                student, task, snapshot, hint_level, cue, now,
            )
            status = "yellow"
            if stuck_since is None:
                stuck_since = now
            changes["last_hint_at"] = now
            changes["stuck_reason"] = new_hint["reason"]
            changes["concept"] = new_hint["concept"]

    changes["status"] = status
    changes["hint_level"] = hint_level
    changes["stuck_since"] = stuck_since
    students.update_one({"_id": student_id}, {"$set": changes})

    # The student only sees level, text, and from_ships_log.
    student_hint = None
    if new_hint is not None:
        student_hint = {
            "level": new_hint["level"],
            "text": new_hint["text"],
            "from_ships_log": new_hint["from_ships_log"],
        }

    return jsonify({"status": status, "hint": student_hint})


def make_hint(student, task, snapshot, level, cue, now):
    """Ask Athena for a hint and save it in the hints collection."""
    student_id = student["_id"]
    task_id = task.get("_id")

    # Hints this student already saw on this task, so Athena won't repeat.
    past_hints = []
    for old_hint in hints.find({"student_id": student_id, "task_id": task_id}):
        past_hints.append(old_hint["text"])

    hint = get_hint(student, task, snapshot, level, cue, past_hints)

    hints.insert_one({
        "student_id": student_id,
        "task_id": task_id,
        "level": hint["level"],
        "text": hint["text"],
        "reason": hint["reason"],
        "concept": hint["concept"],
        "cue": cue,
        "from_ships_log": hint["from_ships_log"],
        "siren_blocked": hint["siren_blocked"],
        "source": hint["source"],
        "helped": False,
        "created_at": now,
    })
    return hint


def reach_ithaca(student_id, task_id, snapshot):
    """The task is done: dock the ship and remember the hint that helped."""
    students.update_one(
        {"_id": student_id},
        {"$set": {
            "status": "ithaca",
            "stuck_reason": None,
            "concept": None,
            "hint_level": 0,
            "stuck_since": None,
            "same_error_count": 0,
            "wrong_output_count": 0,
            "last_error": None,
        }},
    )

    # If a hint was given on this task, the newest one helped.
    last_hint = hints.find_one(
        {"student_id": student_id, "task_id": task_id},
        sort=[("created_at", -1)],
    )
    if last_hint is not None:
        hints.update_one({"_id": last_hint["_id"]}, {"$set": {"helped": True}})
        save_helpful(last_hint, snapshot)


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
