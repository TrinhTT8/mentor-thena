"""Sea Map logic: real data for the task, status, seamap, resolve,
and demo reset routes.

Each function returns None when the student or class is not found.
The route in app.py turns that into a 404.
"""

from datetime import datetime, timezone

from db import students, tasks, snapshots, hints, classes

# Fields that hold a student's stuck state, and their "fresh" values.
# Used by resolve and demo reset to put a ship back to green.
FRESH_STUDENT_STATE = {
    "status": "green",
    "stuck_reason": None,
    "concept": None,
    "hint_level": 0,
    "stuck_since": None,
    "same_error_count": 0,
    "wrong_output_count": 0,
    "last_error": None,
    "last_hint_at": None,
    "recent_activity": [],
}


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


def get_task(student_id):
    """Return the student's current task. Never includes expected_output."""
    student = students.find_one({"_id": student_id})
    if student is None:
        return None

    # Only ask MongoDB for the fields we are allowed to send.
    task = tasks.find_one(
        {"_id": student.get("current_task_id")},
        {"title": 1, "instructions": 1},
    )
    if task is None:
        return None

    result = {
        "task_id": task["_id"],
        "title": task.get("title"),
        "instructions": task.get("instructions"),
    }
    return result


def get_status(student_id):
    """Return the student's own ship color, and a hint while stuck."""
    student = students.find_one({"_id": student_id})
    if student is None:
        return None

    status = student.get("status", "green")

    # Green and Ithaca ships show no hint, so an old hint
    # doesn't stay on screen after the kid fixed the bug.
    student_hint = None
    if status == "yellow" or status == "red":
        hint_doc = hints.find_one(
            {
                "student_id": student_id,
                "task_id": student.get("current_task_id"),
            },
            sort=[("created_at", -1)],
        )
        if hint_doc is not None:
            student_hint = {
                "level": hint_doc.get("level"),
                "text": hint_doc.get("text"),
                "from_ships_log": hint_doc.get("from_ships_log", False),
            }

    return {"status": status, "hint": student_hint}


def seconds_since(date, now):
    """How many seconds ago a date was."""
    # MongoDB gives back dates without a time zone, but they are UTC.
    if date.tzinfo is None:
        date = date.replace(tzinfo=timezone.utc)

    return (now - date).total_seconds()


def get_seamap(class_id):
    """Return every ship in the class, plus the class stats."""
    class_doc = classes.find_one({"_id": class_id})
    if class_doc is None:
        return None

    now = datetime.now(timezone.utc)
    ships = []
    student_ids = []
    stuck_seconds = []

    for student in students.find({"class_id": class_id}):
        student_ids.append(student["_id"])
        status = student.get("status", "green")
        stuck_since = student.get("stuck_since")

        # Remember how long each yellow or red ship has been stuck.
        if status == "yellow" or status == "red":
            if stuck_since is not None:
                stuck_seconds.append(seconds_since(stuck_since, now))

        ship = {
            "id": student["_id"],
            "name": student.get("name"),
            "status": status,
            "reason": student.get("stuck_reason"),
            "concept": student.get("concept"),
            "hint_level": student.get("hint_level", 0),
            "stuck_since": to_iso(stuck_since),
        }
        ships.append(ship)

    # Average time stuck, over the ships that are stuck right now.
    avg_seconds_stuck = 0
    if len(stuck_seconds) > 0:
        avg_seconds_stuck = round(sum(stuck_seconds) / len(stuck_seconds))

    # How many hints Siren Guard blocked for this class's students.
    siren_blocks = hints.count_documents({
        "student_id": {"$in": student_ids},
        "siren_blocked": True,
    })

    result = {
        "class_id": class_id,
        "students": ships,
        "stats": {
            "avg_seconds_stuck": avg_seconds_stuck,
            "siren_blocks": siren_blocks,
        },
    }
    return result


def resolve_student(student_id):
    """The teacher helped this student: the ship goes back to green.

    A ship at Ithaca stays docked, so a finished task can't be undone
    by accident.
    """
    student = students.find_one({"_id": student_id})
    if student is None:
        return None

    if student.get("status") == "ithaca":
        return {"ok": True, "status": "ithaca"}

    students.update_one({"_id": student_id}, {"$set": FRESH_STUDENT_STATE})
    return {"ok": True, "status": "green"}


def reset_all_ships():
    """Before a demo run: every ship back to green, old data deleted.

    Names and tasks stay. Hints and snapshots are deleted,
    and the old Tiresias tip is cleared.
    """
    student_ids = []
    for student in students.find({}, {"_id": 1}):
        student_ids.append(student["_id"])

    students.update_many({}, {"$set": FRESH_STUDENT_STATE})
    hints.delete_many({"student_id": {"$in": student_ids}})
    snapshots.delete_many({"student_id": {"$in": student_ids}})
    classes.update_many({}, {"$set": {"latest_insight": None}})

    return {"ok": True, "students_reset": len(student_ids)}
