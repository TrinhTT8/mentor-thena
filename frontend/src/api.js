// Fetch helpers for the Flask API. Vite proxies /api to Flask in development.

async function getJson(path) {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json()
}

export function getHealth() {
  return getJson('/api/health')
}
