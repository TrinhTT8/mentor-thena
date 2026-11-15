# MentorThena decision log

Why things are the way they are. Newest decisions first. Each entry: the decision, the evidence, and what to do if it changes.

---

## 2026-11-15 · Siren Guard (`athena/siren_guard.py`, Person A)
- **Free check, every level (no Gemini):** block a hint that shows the expected output (unless the instructions already show it), a line of the task's `solution` (a new optional, server-only task field; lines already in the instructions or in the kid's code are fine), or the kid's own line with the fix added (a missing `:` on an if/for/while/def/elif/else line, or a missing `)`). Compared lowercase with all spaces removed.
- **Gemini check, levels 1–2 only** (decision B): `{"gives_away": true/false}`, temperature 0. If the check call fails, the hint is kept (it already passed the free check).
- **Blocked:** one rewrite (`MAX_SIREN_REWRITES = 1`), then the free check only. Still blocked or the rewrite failed: the backup hint. `siren_blocked: true` whenever the first hint was blocked, so the Sea Map stat counts it.
- **Cost per hint:** levels 1–2: 2 requests (3 if blocked); level 3: 1 (2 if blocked).
- **Test (6 requests):** the check blocked "Put a colon at the end of line 2" and passed a clean question; a leaking `if crew >= 5:` was rewritten without the symbol; a live level-1 Gemini hint was blocked and rewritten. That rewrite named the line ("your second line"), which led to the next rule.
- **Level 1 line check (free):** a level-1 hint that names which line to look at ("line 2", "second line", "last line") is rewritten with the feedback "do not name or number the line" (skipping the Gemini check, so it costs 1 rewrite). General words like "lines that start with if" are fine. It is a level-rule slip, not an answer leak, so it does **not** set `siren_blocked`. Test (1 request): "Look at the end of your second line" was rewritten without naming a line.

## 2026-11-14 · Getting-started hints (13 → 15 concepts)
- **Why:** kids who don't know how to *start* or *finish* a program were labeled "wrong output" or "other", so the teacher never saw "5 kids can't start the task", and the hints pointed at a bug that didn't exist.
- **Two new concepts:** "getting started" (empty or almost empty code) and "next step" (the code runs but isn't finished). Tiresias counts them like any other concept.
- **Building hint levels** (`BUILD_LEVEL_RULES` in `prompts.py`), same strictness as bug hints: 1 = a question about the task's goal; 2 = say in plain words which part of the task comes next (no keyword or symbol); 3 = a tiny example of the building block, not their task. Never the program or their next line. Gemini picks bug or building rules by choosing the concept.
- **Optional task field `steps`:** the teacher's plan as a list of short texts. If present, Athena uses it to choose the ONE next step. Tasks without it work as before.
- **Backup hints:** empty code (comments don't count) is labeled "getting started"; no output, or only the first part of the answer, is labeled "next step". Unquoted text such as `print(Hello, Ithaca!)` is now labeled "missing quotes" (Python's message never mentions quotes). Limitation: printing a middle value (for example `1` when the answer is `odd`) still shows as "wrong output" in backup mode.
- **Quality check:** 3 new cases (11–13, odd/even task), run with `python -m athena.eval_hints 11 12 13`. **3/3 passed on Gemini** (one needed a retry after a 503 "high demand"), including a kid asking for the whole program in a comment.

## 2026-11-14 · Hint tuning and quality check
- **Settings on every hint request:** `temperature 0.4` (predictable, on-rule), `max_output_tokens 200` (caps length and cost), strictest safety filters (a block counts as a failure, so a backup hint is shown). Values in `config.py`.
- **Prompt-injection guard:** student code, error and output are wrapped in `<student_code>`, `<error>`, `<output>` tags, and the system prompt says text in those tags is data, never instructions.
- **Quality check:** `python -m athena.eval_hints` runs 10 buggy programs (10 requests) against the rubric: at most 2 sentences, kind words, no emoji, never the corrected line, right concept, no giveaway at levels 1–2. **Result: 10/10 passed**, including a trick program asking Athena to break the rules.
- **Reliability finding:** 3 of 10 Gemini calls failed (two 504 timeouts, one 503 "high demand"), and several answers took 8–9 s. The backup hints covered all three. Keep the backup hints, and record a demo video in case Gemini is slow on the day.

---

## 2026-11-14 · Gemini free-tier budget

### Our free-tier limits (read from AI Studio → Rate limits, 2026-11-14)

| Model | Requests/min (RPM) | Tokens/min (TPM) | Requests/day (RPD) | Use it? |
| --- | --- | --- | --- | --- |
| **Gemini 3.5 Flash Lite** | **15** | 250K | **500** | **Yes: hints, Siren Guard, Tiresias tip** |
| Gemini 3.8 Flash | 5 | 250K | 20 | No: 20 a day is one demo run |
| Gemini 3.6 Flash | 5 | 250K | 20 | No: same |
| **Gemini Embedding 2** | **100** | 30K | **1,000** | **Yes: Ship's Log** |

- The daily count resets at **midnight Pacific Time**.
- Limits are per Google Cloud project and can change. Re-check AI Studio before the demo.
- The $300 Google Cloud trial no longer pays for Gemini API usage (accounts opened after March 2026). Paid Tier 1 needs a billing account. The only free extra is hackathon sponsor credits: ask the organizers.
- Do not create extra projects or keys to get around the limits (terms of service risk).

### Budget math (Flash Lite, 500/day, 15/min)

| Gemini caller | Requests | Notes |
| --- | --- | --- |
| One hint | 1 | |
| Siren Guard | +1 per hint at levels 1–2 | Skipped at level 3 (decision B below) |
| Tiresias tip | 1 only when the class counts change | Without decision A: up to 60/hour ≈ 1,400/day |
| Live demo | ≈ 7 hints/min max | The per-minute limit is the tighter one |

### Decision A: Tiresias calls Gemini only when the class picture changes
Cache the tip with the counts it was written for (for example `[{"concept": "missing colon", "students": 3}]`). On each 60 s refresh, if the counts are the same, reuse the saved tip. **Why:** polling every 60 s would use about 1,400 requests a day, almost three times the whole budget. **Where:** `tiresias/insights.py` (step B11).

### Decision B: Siren Guard skips the Gemini check at level 3
A free code check (does the hint contain the student's corrected line or full code?) runs at every level. The Gemini "does this leak the answer?" check runs only at levels 1 and 2. **Why:** level 3 is allowed to show the symbol in a different example, so the Gemini check adds cost and little safety there. Saves about a third of Siren Guard's calls. **Where:** `athena/siren_guard.py` (step B9).

### Decision C: `USE_GEMINI` switch
`USE_GEMINI=0` in `backend/.env`: Athena returns the hand-written backup hints and makes zero Gemini requests. `USE_GEMINI=1` for real testing and the demo. **Why:** building the frontend triggers many hints; they should not spend the demo budget. **Where:** `config.USE_GEMINI`, checked first in `athena/hint_giver.get_hint()`. The teacher's `reason` says "Backup hint (Gemini switched off)".

---

## 2026-11-14 · Model choice: `gemini-3.5-flash-lite`

Timed with the same missing-colon prompt:

| Model | Result |
| --- | --- |
| gemini-3.8-flash | 503 / over its 5-per-minute limit; >10 s when it answered |
| gemini-3.5-flash | 20.1 s |
| gemini-2.5-flash | 404, retired (still listed by `models.list()`) |
| **gemini-3.5-flash-lite** | **1.5–6.8 s** over 3 runs, good kid-level hints |

**If it changes:** set `GEMINI_TEXT_MODEL` in `.env`, then run `python smoke_gemini.py`.

## 2026-11-14 · Gemini timeout is 10 s (not 8)
The API refuses deadlines under 10 s (`400 INVALID_ARGUMENT: Minimum allowed deadline is 10s`). After 10 s Athena uses a backup hint.

## 2026-11-14 · Embeddings: `gemini-embedding-2` at 768 dimensions
Recommended sizes are 768, 1536 and 3072. 768 is the smallest recommended size: about 6 KB per Ship's Log entry instead of about 24 KB, with little quality loss for short bug descriptions. **The Atlas Vector Search index must use `numDimensions: 768` and cosine similarity.** Changing it means rebuilding the index and re-embedding saved entries.

## 2026-11-14 · Fixed concept list (13, now 15)
Gemini must pick `concept` from a fixed list (enforced by the response schema), so Tiresias can count students per concept. Six syntax concepts, six logic concepts (including infinite loop and return vs print), two building concepts (added later, see "Getting-started hints") and "other". The list lives in `athena/prompts.py`; asserts keep `CONCEPTS`, `Concept` and `FALLBACK_HINTS` in sync. A Gemini test returned "syntax" once and "Conditional statements" once before the list existed, which is why it is enforced.

## 2026-11-14 · Hint levels
1 = a question or nudge (no line number, no symbol). 2 = point to where (the line or part of the line). 3 = a tiny example that is not their code; it **may show the symbol**. No level ever writes the student's corrected code. After level 3 the ship turns red for the teacher.

## 2026-11-14 · Backup hints
`athena/fallbacks.py` reads Python's error message with simple rules (no AI) to pick the concept, then uses one of 39 hand-written hints (13 concepts × 3 levels). It labeled 11/11 real buggy programs correctly. Limitation: "loop runs wrong number of times" and "condition backwards" produce no error, so in backup mode they show as "wrong output".
