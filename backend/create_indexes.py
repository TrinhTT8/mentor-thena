"""Create MongoDB indexes. Safe to run more than once.

The Atlas Vector Search index for ship_log is created in the Atlas website (later step).
"""

from pymongo import ASCENDING, DESCENDING

import db

SNAPSHOT_TTL_SECONDS = 7 * 24 * 60 * 60  # student privacy: auto-delete after 7 days


def main():
    # Snapshots auto-delete 7 days after created_at (must be a BSON date, not a string).
    db.snapshots.create_index(
        "created_at", expireAfterSeconds=SNAPSHOT_TTL_SECONDS, name="ttl_created_at"
    )
    # Argus reads a student's latest snapshots.
    db.snapshots.create_index(
        [("student_id", ASCENDING), ("created_at", DESCENDING)], name="student_latest"
    )
    # Sea Map loads all students in a class.
    db.students.create_index("class_id", name="by_class")
    # Latest hint per student.
    db.hints.create_index(
        [("student_id", ASCENDING), ("created_at", DESCENDING)], name="student_latest"
    )

    for name in ["snapshots", "students", "hints"]:
        print(f"{name}: {sorted(db.db[name].index_information())}")


if __name__ == "__main__":
    main()
