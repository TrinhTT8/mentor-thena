"""MongoDB Atlas connection. Import `db` anywhere: `from db import db`."""

from pymongo import MongoClient

import config

if not config.MONGODB_URI:
    raise RuntimeError("MONGODB_URI is missing. Copy .env.example to .env and fill it in.")

# One client for the whole app (it keeps its own connection pool).
client = MongoClient(config.MONGODB_URI, serverSelectionTimeoutMS=8000, appname="mentorthena")
db = client[config.MONGODB_DB]

# Collections
students = db["students"]
tasks = db["tasks"]
snapshots = db["snapshots"]
hints = db["hints"]
ship_log = db["ship_log"]
classes = db["classes"]


def ping():
    """Return True if Atlas answers, raise if it can't be reached."""
    client.admin.command("ping")
    return True


if __name__ == "__main__":
    ping()
    print(f"Connected to MongoDB Atlas, database '{config.MONGODB_DB}'.")
