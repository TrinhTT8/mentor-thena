"""MentorThena Flask API. Returns JSON only; React handles all pages."""

from datetime import datetime, timezone

from flask import Flask, jsonify, request

import config
from argus import watcher
from athena.hint_giver import get_hint
from db import students, tasks, snapshots, hints
# STUB: save_helpful is still a stub until Person B writes ships_log/memory.py.
# TODO: swap for Person B's real function
from person_b_stubs import save_helpful
from seamap import dashboard
from tiresias import class_counts

app = Flask(__name__)


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.get("/api/task/<student_id>")
def get_task(student_id):
    """Send the student's current task. Never sends expected_output."""
    result = dashboard.get_task(student_id)
    if result is None:
        return jsonify({"error": "student or task not found"}), 404

    return jsonify(result)


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
    """Send the student's own ship color, and their hint while stuck."""
    result = dashboard.get_status(student_id)
    if result is None:
        return jsonify({"error": "student not found"}), 404

    return jsonify(result)


@app.get("/api/seamap/<class_id>")
def get_seamap(class_id):
    """Send every ship in the class for the teacher's Sea Map."""
    result = dashboard.get_seamap(class_id)
    if result is None:
        return jsonify({"error": "class not found"}), 404

    return jsonify(result)


@app.get("/api/insight/<class_id>")
def get_insight(class_id):
    """Send the Tiresias tip for the teacher (cached for 60 seconds)."""
    result = class_counts.get_insight(class_id)
    if result is None:
        return jsonify({"error": "class not found"}), 404

    return jsonify(result)


@app.post("/api/resolve/<student_id>")
def resolve_student(student_id):
    """Teacher marks a student as helped: the ship goes back to green."""
    result = dashboard.resolve_student(student_id)
    if result is None:
        return jsonify({"error": "student not found"}), 404

    return jsonify(result)


@app.post("/api/demo/reset")
def demo_reset():
    """Reset every ship before a demo run."""
    result = dashboard.reset_all_ships()
    return jsonify(result)


if __name__ == "__main__":
    app.run(port=config.PORT, debug=True)
