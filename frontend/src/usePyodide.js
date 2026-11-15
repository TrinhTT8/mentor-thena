import { useCallback, useEffect, useRef, useState } from 'react'

// How long a kid's program may run before we stop it (milliseconds).
export const RUN_TIMEOUT_MS = 5000
// The exact error text agreed with the backend: Athena reads it as an "infinite loop".
export const TIMEOUT_ERROR = 'TimeoutError: the code ran too long'

// React hook: loads Python in a background worker and runs code with a time limit.
//   const { status, run } = usePyodide()
//   status: 'loading' | 'ready' | 'running'
//   const { output, error, timedOut } = await run(code)
export default function usePyodide() {
  const [status, setStatus] = useState('loading')
  const workerRef = useRef(null)
  const jobRef = useRef(null) // the run in progress: { id, output, resolve, timer }
  const nextId = useRef(1)

  // Start a new worker (on page load, and again after a timeout kills the old one).
  const startWorker = useCallback(() => {
    const worker = new Worker('/pyodide-worker.js')
    worker.onmessage = (event) => {
      const msg = event.data
      const job = jobRef.current
      if (msg.type === 'ready') {
        setStatus('ready')
      } else if (job && msg.id === job.id && msg.type === 'stdout') {
        job.output.push(msg.text)
      } else if (job && msg.id === job.id && msg.type === 'done') {
        clearTimeout(job.timer)
        jobRef.current = null
        setStatus('ready')
        job.resolve({ output: job.output.join('\n'), error: msg.error, timedOut: false })
      }
    }
    workerRef.current = worker
  }, [])

  useEffect(() => {
    startWorker()
    return () => workerRef.current?.terminate() // page closed: stop the worker
  }, [startWorker])

  const run = useCallback((code) => {
    return new Promise((resolve) => {
      if (jobRef.current) return // one run at a time
      const id = nextId.current++
      const timer = setTimeout(() => {
        // Too slow: probably an infinite loop. Fire this worker and hire a fresh one.
        const job = jobRef.current
        jobRef.current = null
        workerRef.current.terminate()
        setStatus('loading') // the new worker needs a few seconds to load Python again
        startWorker()
        resolve({ output: job.output.join('\n'), error: TIMEOUT_ERROR, timedOut: true })
      }, RUN_TIMEOUT_MS)
      jobRef.current = { id, output: [], resolve, timer }
      setStatus('running')
      workerRef.current.postMessage({ id, code })
    })
  }, [startWorker])

  return { status, run }
}
