"""Create MongoDB indexes. Safe to run more than once.

Also creates the Atlas Vector Search index for the Ship's Log.
"""

from pymongo import ASCENDING, DESCENDING
from pymongo.operations import SearchIndexModel

import config
import db

SNAPSHOT_TTL_SECONDS = 7 * 24 * 60 * 60  # student privacy: auto-delete after 7 days

# Must match VECTOR_INDEX_NAME in ships_log/memory.py.
SHIP_LOG_VECTOR_INDEX = "ship_log_vector"


def create_ship_log_vector_index():
    """Create the Vector Search index on ship_log.embedding (if missing)."""
    # A search index needs the collection to exist first.
    if "ship_log" not in db.db.list_collection_names():
        db.db.create_collection("ship_log")

    existing_names = []
    for index in db.ship_log.list_search_indexes():
        existing_names.append(index["name"])

    if SHIP_LOG_VECTOR_INDEX in existing_names:
        print(f"ship_log: vector index '{SHIP_LOG_VECTOR_INDEX}' already exists")
        return

    vector_index = SearchIndexModel(
        name=SHIP_LOG_VECTOR_INDEX,
        type="vectorSearch",
        definition={
            "fields": [{
                "type": "vector",
                "path": "embedding",
                "numDimensions": config.EMBED_DIMENSIONS,
                "similarity": "cosine",
            }],
        },
    )

    try:
        db.ship_log.create_search_index(vector_index)
        print(f"ship_log: vector index '{SHIP_LOG_VECTOR_INDEX}' created "
              "(Atlas needs about a minute to build it)")
    except Exception as error:
        print(f"ship_log: could not create the vector index: {error}")
        print("Create it in the Atlas website instead:")
        print("  Atlas -> your cluster -> Search & Vector Search -> Create Search Index")
        print("  -> Vector Search -> JSON Editor, database mentorthena, collection ship_log,")
        print(f"  index name {SHIP_LOG_VECTOR_INDEX}, and paste:")
        print('  {"fields": [{"type": "vector", "path": "embedding",')
        print(f'    "numDimensions": {config.EMBED_DIMENSIONS}, "similarity": "cosine"}}]}}')


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

    create_ship_log_vector_index()


if __name__ == "__main__":
    main()
