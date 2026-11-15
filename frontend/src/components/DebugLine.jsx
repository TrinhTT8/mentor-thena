import { useEffect, useState } from 'react'

// Only shown when the address ends in ?debug. Reads the activity numbers once a
// second with peek(), which does NOT reset them, so heartbeats still get the real counts.
export default function DebugLine({ peek }) {
  const [numbers, setNumbers] = useState(() => peek())

  useEffect(() => {
    const timer = setInterval(() => setNumbers(peek()), 1000)
    return () => clearInterval(timer)
  }, [peek])

  return (
    <p className="debug-line">
      since key {numbers.seconds_since_last_key}s · since cursor {numbers.seconds_since_cursor_move}s ·
      typed {numbers.keys_typed} · deleted {numbers.keys_deleted}
    </p>
  )
}
