# Running the backend

Commands for Windows cmd. Mac/Linux notes are in [brackets].

Before you start: do the setup in [README.md](../README.md) once
(venv, `pip install`, `.env`). Then, in every new terminal:

```
cd backend
venv\Scripts\activate
```
[Mac/Linux: `source venv/bin/activate`]


## Backend checks

Is MongoDB Atlas reachable?
```
python db.py
```
Prints: `Connected to MongoDB Atlas, database 'mentorthena'.`
If it times out, add your IP address in Atlas → Network Access.

Create the indexes (safe to run again):
```
python create_indexes.py
```
Prints the index names for `snapshots`, `students`, and `hints`.

Does Gemini answer? (optional)
```
python smoke_gemini.py
```
Prints one test hint as JSON and one embedding length.
It always calls Gemini, so it uses 2 requests from the free daily quota,
even when `USE_GEMINI=0`. Only run it after changing the API key or model,
when hints keep coming back as fallback, or once before the demo.


## Run Flask

```
python app.py
```
Runs on http://localhost:5000. It needs `MONGODB_URI` and `GEMINI_API_KEY`
in `.env`, because `app.py` connects to MongoDB and loads the Gemini client
when it starts.

Gemini on/off: `USE_GEMINI` in `.env`.
- `USE_GEMINI=0`: free backup hints, zero Gemini requests (use while building)
- `USE_GEMINI=1`: real Gemini hints (real testing and the demo). Missing = 1

Restart Flask (Ctrl+C, then `python app.py`) after changing `.env`.
The snapshot route calls Athena's real `get_hint`. With `USE_GEMINI=0`
the hints come from `athena/fallbacks.py`.


## Seed the demo class and run the bot simulator

Open a second terminal (activate the venv there too):
```
python seed_demo.py
```
This first clears class c1's old students, snapshots, and hints, then creates:
- class `c1`, tasks `t1`–`t3`, and students `s1`–`s8`
- `s1` (Maya) is the live student. The simulator never touches s1
- bots `s2`–`s8` start in a mix of green, yellow, red, and ithaca

Then the bot simulator starts. Every 10 seconds it moves one random bot
one step and prints what changed, for example `s5 Zoe: green (teacher helped)`.
Press Ctrl+C to stop it.

Reset before a demo: stop it and run `python seed_demo.py` again.
Bots that reach Ithaca stay there, so after a long run most bots end up
docked. Re-run the script to get a busy Sea Map again.

Two ways to reset:
- `python seed_demo.py`: the mixed demo class (some yellow, red, ithaca)
- `POST /api/demo/reset` (see below): every ship green, hints and
  snapshots deleted. If the simulator is running, the bots start
  moving again right away


## Test each route

Run these while Flask is running. In PowerShell, type `curl.exe`
instead of `curl`.

"Real" means the route reads MongoDB (seed first).
"STUB" means fake data for now.
An unknown student or class ID gives a 404, for example
`{"error": "student not found"}`.

Health check (real)
```
curl http://localhost:5000/api/health
```
```json
{"ok": true}
```

Current task for a student (real)
```
curl http://localhost:5000/api/task/s1
```
```json
{"task_id": "t1", "title": "Say hello to Ithaca",
 "instructions": "Use print to show: Hello, Ithaca!"}
```
`expected_output` is never sent.

### Snapshot (real)

Every Run is saved in `snapshots`. Heartbeats are not saved.
Argus checks each snapshot, and Athena makes a hint when Argus finds a cue.
These tests change s1, so run `python seed_demo.py` afterwards to reset it.

Run with an error (the first time: no hint yet)
```
curl -X POST http://localhost:5000/api/snapshot -H "Content-Type: application/json" -d "{\"student_id\":\"s1\",\"task_id\":\"t1\",\"event\":\"run\",\"code\":\"if x\",\"output\":\"\",\"error\":\"SyntaxError: expected ':'\"}"
```
[Mac/Linux: put the JSON in single quotes and drop the backslashes]
```json
{"status": "green", "hint": null}
```

Trigger a hint: run the same command 3 times in a row.
The 3rd run gets a level 1 hint (this text is a backup hint, `USE_GEMINI=0`):
```json
{"status": "yellow",
 "hint": {"level": 1,
          "text": "Python lines that start with if, for or while need something special at the end. Can you spot it?",
          "from_ships_log": false}}
```
Running it again within 45 s gives no new hint (cooldown).
After 45 s, the next run gives level 2, then level 3, then the ship turns red.

Reach Ithaca: run with the right output
```
curl -X POST http://localhost:5000/api/snapshot -H "Content-Type: application/json" -d "{\"student_id\":\"s1\",\"task_id\":\"t1\",\"event\":\"run\",\"code\":\"print('Hello, Ithaca!')\",\"output\":\"Hello, Ithaca!\",\"error\":\"\"}"
```
[Mac/Linux: single quotes around the JSON, no backslashes.
Use `print(1)` as the code, because the code's own single quotes would break it]
```json
{"status": "ithaca", "hint": null}
```
After Ithaca, every snapshot answers `"ithaca"` until you re-seed.

Heartbeat, student is busy (no hint)
```
curl -X POST http://localhost:5000/api/snapshot -H "Content-Type: application/json" -d "{\"student_id\":\"s1\",\"task_id\":\"t1\",\"event\":\"heartbeat\",\"code\":\"\",\"output\":\"\",\"error\":\"\",\"activity\":{\"seconds_since_last_key\":5,\"seconds_since_cursor_move\":5,\"keys_typed\":12,\"keys_deleted\":3}}"
```
[Mac/Linux: single quotes around the JSON, no backslashes]
```json
{"status": "green", "hint": null}
```

Heartbeat, student is idle (no key AND no cursor move for 60 s or more)
```
curl -X POST http://localhost:5000/api/snapshot -H "Content-Type: application/json" -d "{\"student_id\":\"s1\",\"task_id\":\"t1\",\"event\":\"heartbeat\",\"code\":\"\",\"output\":\"\",\"error\":\"\",\"activity\":{\"seconds_since_last_key\":65,\"seconds_since_cursor_move\":65,\"keys_typed\":0,\"keys_deleted\":0}}"
```
[Mac/Linux: single quotes around the JSON, no backslashes]
```json
{"status": "yellow", "hint": {"level": 1, "text": "...", "from_ships_log": false}}
```

Snapshot without student_id (error 400)
```
curl -X POST http://localhost:5000/api/snapshot -H "Content-Type: application/json" -d "{\"event\":\"run\"}"
```
[Mac/Linux: `-d '{"event":"run"}'`]
```json
{"error": "student_id is required"}
```

Snapshot for a student who does not exist (error 404)
```
curl -X POST http://localhost:5000/api/snapshot -H "Content-Type: application/json" -d "{\"student_id\":\"nobody\",\"event\":\"run\"}"
```
[Mac/Linux: `-d '{"student_id":"nobody","event":"run"}'`]
```json
{"error": "student not found"}
```

Student's own ship (real)
```
curl http://localhost:5000/api/status/s1
```
```json
{"status": "green", "hint": null}
```
The hint only shows while the ship is yellow or red (the newest hint
on the current task). Green and Ithaca always give `"hint": null`.
```json
{"status": "yellow",
 "hint": {"level": 1,
          "text": "Python lines that start with if, for or while need something special at the end. Can you spot it?",
          "from_ships_log": false}}
```

Sea Map for the teacher (real)
```
curl http://localhost:5000/api/seamap/c1
```
```json
{"class_id": "c1",
 "students": [
   {"id": "s1", "name": "Maya", "status": "green", "reason": null,
    "concept": null, "hint_level": 0, "stuck_since": null},
   {"id": "s4", "name": "Noah", "status": "yellow",
    "reason": "No typing for 60 seconds", "concept": "indentation",
    "hint_level": 2, "stuck_since": "2026-11-14T23:33:12.990000+00:00"}
 ],
 "stats": {"avg_seconds_stuck": 113, "siren_blocks": 0}}
```
(shortened: the real response has all 8 students)
- `avg_seconds_stuck`: average time stuck over the yellow and red ships
  right now, in whole seconds. 0 when nobody is stuck
- `siren_blocks`: how many of this class's hints Siren Guard blocked,
  since the last seed or reset

Tiresias tip (STUB until Tiresias is built)
```
curl http://localhost:5000/api/insight/c1
```
```json
{"tip": "2 students are stuck on missing colons. Try a 1-minute mini lesson on if lines.",
 "counts": [{"concept": "missing colon", "students": 2},
            {"concept": "indentation", "students": 1},
            {"concept": "typo in print", "students": 1}],
 "updated_at": "2026-11-15T00:18:46.267087+00:00"}
```

Teacher marks a student as helped (real)
```
curl -X POST http://localhost:5000/api/resolve/s3
```
```json
{"ok": true, "status": "green"}
```
The ship goes green and its stuck state is cleared, so the next time
it gets stuck the hints start again at level 1.
A ship at Ithaca stays docked: `{"ok": true, "status": "ithaca"}`.

Demo reset (real)
```
curl -X POST http://localhost:5000/api/demo/reset
```
```json
{"ok": true, "students_reset": 8}
```
Every ship goes green with its stuck state cleared. Names and tasks stay.
All hints and snapshots are deleted, and the old Tiresias tip is cleared.
To get the mixed demo class back, run `python seed_demo.py` instead.
