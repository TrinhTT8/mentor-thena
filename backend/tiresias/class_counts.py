"""Tiresias (Person A part): count stuck students by concept for a class.

The counts go to Person B's write_tip(), which turns them into one short
tip for the teacher. The result is cached in classes.latest_insight.

Person B's write_tip() lives in tiresias/insights.py. Do not put it here,
so we never edit the same file.
"""

from datetime import datetime, timezone

import config
from db import students, classes
from seamap.dashboard import to_iso, seconds_since
# STUB: write_tip is still a stub until Person B adds it to tiresias/insights.py.
# TODO: swap for Person B's real function:
#       from tiresias.insights import write_tip
from person_b_stubs import write_tip

CALM_SEA_TIP = "Everyone is sailing fine right now."


def count_stuck_by_concept(class_id):
    """Count the class's stuck students (yellow or red) for each concept.

    Returns a list like [{"concept": "missing colon", "students": 3}],
    biggest group first.
    """
    pipeline = [
        # Only this class's stuck students that have a concept.
        {"$match": {
            "class_id": class_id,
            "status": {"$in": ["yellow", "red"]},
            "concept": {"$ne": None},
        }},
        # One group per concept, counting the students in it.
        {"$group": {
            "_id": "$concept",
            "students": {"$sum": 1},
        }},
        # Biggest group first. Same size: A to Z.
        {"$sort": {"students": -1, "_id": 1}},
        # Rename _id to concept, to match the API contract.
        {"$project": {
            "_id": 0,
            "concept": "$_id",
            "students": 1,
        }},
    ]

    counts = []
    for row in students.aggregate(pipeline):
        counts.append({"concept": row["concept"], "students": row["students"]})
    return counts


def simple_tip(counts):
    """A plain tip from the counts, used if write_tip fails."""
    top = counts[0]
    if top["students"] == 1:
        return f"1 student is stuck on {top['concept']}."
    return f"{top['students']} students are stuck on {top['concept']}."


def make_tip(counts):
    """Ask Person B's write_tip for a teacher tip. Never fails."""
    try:
        return write_tip(counts)
    except Exception:
        # Gemini slow or down: the teacher still sees something useful.
        return simple_tip(counts)


def format_insight(insight):
    """Turn a stored insight into the API shape."""
    result = {
        "tip": insight.get("tip"),
        "counts": insight.get("counts", []),
        "updated_at": to_iso(insight.get("updated_at")),
    }
    return result


def get_insight(class_id):
    """Return the Tiresias tip for a class, cached for 60 seconds.

    Returns None when the class is not found.
    """
    class_doc = classes.find_one({"_id": class_id})
    if class_doc is None:
        return None

    now = datetime.now(timezone.utc)
    # MongoDB keeps dates to the millisecond. Round now the same way,
    # so the first answer has the same updated_at as the cached ones.
    milliseconds = now.microsecond // 1000
    now = now.replace(microsecond=milliseconds * 1000)

    cached = class_doc.get("latest_insight")

    # The cached tip is still fresh: send it as it is.
    if cached is not None:
        cache_age = seconds_since(cached["updated_at"], now)
        if cache_age < config.INSIGHT_CACHE_SECONDS:
            return format_insight(cached)

    counts = count_stuck_by_concept(class_id)

    if len(counts) == 0:
        # Nobody is stuck: no need to ask write_tip.
        tip = CALM_SEA_TIP
    elif cached is not None and cached.get("counts") == counts:
        # Same counts as last time: keep the old tip, save a Gemini call.
        tip = cached.get("tip")
    else:
        tip = make_tip(counts)

    insight = {
        "tip": tip,
        "counts": counts,
        "updated_at": now,
    }
    classes.update_one({"_id": class_id}, {"$set": {"latest_insight": insight}})

    return format_insight(insight)
