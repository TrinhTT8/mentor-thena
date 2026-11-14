"""Smoke test: one kid-level hint as JSON, and one embedding. Run: python smoke_gemini.py"""

import time

from pydantic import BaseModel

import config
from gemini_client import embed, generate_json


class Hint(BaseModel):
    hint: str
    reason: str
    concept: str


SYSTEM = (
    "You are Athena, a friendly coding helper for kids aged 8 to 10. "
    "Give ONE short hint (max 2 sentences) as a question or nudge. Never give the fixed code or the answer."
)

PROMPT = """Task: print "Big number!" if age is more than 8.
Student code:
age = 10
if age > 8
    print("Big number!")
Error: SyntaxError: expected ':' (line 2)
Hint level: 1 (a question or nudge only)."""


def main():
    start = time.perf_counter()
    hint = generate_json(PROMPT, Hint, system=SYSTEM)
    print(f"[{config.GEMINI_TEXT_MODEL}] {time.perf_counter() - start:.1f}s")
    print(hint.model_dump_json(indent=2))

    start = time.perf_counter()
    vector = embed("SyntaxError: expected ':' | missing colon")
    print(f"[{config.GEMINI_EMBED_MODEL}] {time.perf_counter() - start:.1f}s, length {len(vector)}")


if __name__ == "__main__":
    main()
