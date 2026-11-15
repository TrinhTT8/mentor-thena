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
Runs on http://localhost:5000. It needs `MONGODB_URI` in `.env`,
because `app.py` connects to MongoDB when it starts.

Gemini on/off: `USE_GEMINI` in `.env`.
- `USE_GEMINI=0`: free backup hints, zero Gemini requests (use while building)
- `USE_GEMINI=1`: real Gemini hints (real testing and the demo). Missing = 1

Restart Flask (Ctrl+C, then `python app.py`) after changing `.env`.
Right now the routes still use stub hints, so this switch changes nothing
until the snapshot route calls the real `get_hint`.


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


## Test each route

Run these while Flask is running. In PowerShell, type `curl.exe`
instead of `curl`.

"Real" means the route reads MongoDB (seed first).
"STUB" means fake data for now.

Health check (real)
```
curl http://localhost:5000/api/health
```
```json
{"ok": true}
```

Current task for a student (real; fake task `t1` if the student is not found)
```
curl http://localhost:5000/api/task/s1
```
```json
{"task_id": "t1", "title": "Say hello to Ithaca",
 "instructions": "Use print to show: Hello, Ithaca!"}
```
`expected_output` is never sent.

Snapshot on Run (STUB: nothing is saved, always a level 1 hint)
```
curl -X POST http://localhost:5000/api/snapshot -H "Content-Type: application/json" -d "{\"student_id\":\"s1\",\"task_id\":\"t1\",\"event\":\"run\",\"code\":\"print('hi')\",\"output\":\"hi\",\"error\":\"\"}"
```
[Mac/Linux: put the JSON in single quotes and drop the backslashes:
`-d '{"student_id":"s1","task_id":"t1","event":"run","code":"print(1)","output":"1","error":""}'`]
```json
{"status": "yellow",
 "hint": {"level": 1, "text": "What does Python need at the end of an if line?",
          "from_ships_log": false}}
```

Snapshot heartbeat (STUB: always green, no hint)
```
curl -X POST http://localhost:5000/api/snapshot -H "Content-Type: application/json" -d "{\"student_id\":\"s1\",\"task_id\":\"t1\",\"event\":\"heartbeat\",\"code\":\"\",\"output\":\"\",\"error\":\"\",\"activity\":{\"seconds_since_last_key\":5,\"seconds_since_cursor_move\":5,\"keys_typed\":12,\"keys_deleted\":3}}"
```
[Mac/Linux: single quotes around the JSON, no backslashes]
```json
{"status": "green", "hint": null}
```

Snapshot without student_id (error 400)
```
curl -X POST http://localhost:5000/api/snapshot -H "Content-Type: application/json" -d "{\"event\":\"run\"}"
```
[Mac/Linux: `-d '{"event":"run"}'`]
```json
{"error": "student_id is required"}
```

Student's own ship (real; fake yellow + hint if the student is not found)
```
curl http://localhost:5000/api/status/s1
```
```json
{"status": "green", "hint": null}
```

Sea Map for the teacher (real students; `stats` is STUB)
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
 "stats": {"avg_seconds_stuck": 95, "siren_blocks": 2}}
```
(shortened: the real response has all 8 students)

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

Teacher marks a student as helped (STUB: the ship does not change yet)
```
curl -X POST http://localhost:5000/api/resolve/s3
```
```json
{"ok": true, "status": "green"}
```

Demo reset (STUB: nothing is reset yet; use `python seed_demo.py`)
```
curl -X POST http://localhost:5000/api/demo/reset
```
```json
{"ok": true}
```
