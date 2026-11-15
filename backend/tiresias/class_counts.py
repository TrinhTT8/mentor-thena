"""Tiresias: count stuck students by concept for a class.

The counts go to write_tip() in tiresias/insights.py, which turns them
into one short tip for the teacher. The result is cached in
classes.latest_insight.

When the counts change, the old tip is sent at once and the new tip is
written in a background thread, so the teacher's Sea Map never waits
for Gemini.
"""

import logging
import threading
from datetime import datetime, timezone

import config
from db import students, classes
from seamap.dashboard import to_iso, seconds_since
from tiresias.insights import write_tip

CALM_SEA_TIP = "Everyone is sailing fine right now."

log = logging.getLogger(__name__)

# Classes whose new tip is being written right now, so we never start
# two background threads for the same class.
tips_in_progress = set()
tips_lock = threading.Lock()


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
    """Ask write_tip for a teacher tip. Never fails."""
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
    elif cached is not None:
        # The counts changed. Send the old tip now, with the new counts,
        # and write the new tip in the background. The next call gets it.
        start_tip_in_background(class_id, counts)
        old_tip_now = {
            "tip": cached.get("tip"),
            "counts": counts,
            "updated_at": cached.get("updated_at"),
        }
        return format_insight(old_tip_now)
    else:
        # No tip yet at all (first open after a reset): nothing older to show.
        tip = make_tip(counts)

    save_insight(class_id, tip, counts, now)
    insight = {
        "tip": tip,
        "counts": counts,
        "updated_at": now,
    }
    return format_insight(insight)


def save_insight(class_id, tip, counts, now):
    """Save the tip and counts as the class's cached insight."""
    insight = {
        "tip": tip,
        "counts": counts,
        "updated_at": now,
    }
    classes.update_one({"_id": class_id}, {"$set": {"latest_insight": insight}})


def start_tip_in_background(class_id, counts):
    """Write a new tip in a background thread, unless one is already running."""
    with tips_lock:
        if class_id in tips_in_progress:
            return
        tips_in_progress.add(class_id)

    thread = threading.Thread(
        target=write_tip_in_background,
        args=(class_id, counts),
        daemon=True,
    )
    thread.start()


def write_tip_in_background(class_id, counts):
    """Ask write_tip for the new tip, then save it. Runs in its own thread."""
    try:
        tip = make_tip(counts)

        # Round to the millisecond, like get_insight, to match MongoDB dates.
        now = datetime.now(timezone.utc)
        milliseconds = now.microsecond // 1000
        now = now.replace(microsecond=milliseconds * 1000)

        save_insight(class_id, tip, counts, now)
    except Exception:
        # The teacher keeps the old tip; the next call will try again.
        log.exception("Tiresias: could not write the new tip for %s", class_id)
    finally:
        with tips_lock:
            tips_in_progress.discard(class_id)
