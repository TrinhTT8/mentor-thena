// Fetch helpers for the Flask API. Vite proxies /api to Flask in development.

async function getJson(path) {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json()
}

async function postJson(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json()
}

export function getHealth() {
  return getJson('/api/health')
}

// -> { task_id, title, instructions }   (never expected_output)
export function getTask(studentId) {
  return getJson(`/api/task/${encodeURIComponent(studentId)}`)
}

// -> { status: "green" | "yellow" | "red" | "ithaca", hint: {...} | null }
export function getStatus(studentId) {
  return getJson(`/api/status/${encodeURIComponent(studentId)}`)
}

// snapshot ={ student_id, task_id, event: "run" | "heartbeat", code, output, error, activity? }
// -> { status, hint: { level, text, from_ships_log } | null }
export function sendSnapshot(snapshot) {
  return postJson('/api/snapshot', snapshot)
}
