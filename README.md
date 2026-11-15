# MentorThena

An AI teaching assistant for beginner coding classes. It notices when a student is stuck,
gives a kid-level hint (never the answer), and shows the teacher who needs help and why.

Built with React + Vite, Flask, Gemini API, and MongoDB Atlas.

## Project layout

```
backend/    Flask API (Argus, Athena, Ship's Log, Tiresias, Sea Map)
frontend/   React + Vite app (student page and teacher Sea Map)
```

## Run locally

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
copy .env.example .env         # then fill in your keys (cp on macOS / Linux)
python app.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the student page at `/student/s1` and the teacher Sea Map at `/teacher/c1`.

```
[PLACEHOLDER - FOLDER NAME DEFINITION]
```
