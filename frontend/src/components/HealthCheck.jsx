import { useEffect, useState } from 'react'
import { getHealth } from '../api.js'

// Temporary: shows whether the frontend can reach Flask. Remove once real data flows.
export default function HealthCheck() {
  const [text, setText] = useState('Checking API...')

  useEffect(() => {
    getHealth()
      .then(() => setText('API connected'))
      .catch(() => setText('API not reachable. Is Flask running?'))
  }, [])

  return <p>{text}</p>
}
