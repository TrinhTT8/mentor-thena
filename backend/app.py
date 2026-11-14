"""MentorThena Flask API. Returns JSON only; React handles all pages."""

from flask import Flask, jsonify

import config

app = Flask(__name__)


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(port=config.PORT, debug=True)
