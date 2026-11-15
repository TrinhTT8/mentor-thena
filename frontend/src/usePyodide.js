import { useCallback, useEffect, useRef, useState } from 'react'

// How long a kid's program may run before we stop it (milliseconds).
export const RUN_TIMEOUT_MS = 5000
// The exact error text agreed with the backend: Athena reads it as an "infinite loop".
export const TIMEOUT_ERROR = 'TimeoutError: the code ran too long'

// React hook: loads Python in a background worker and runs code with a time limit.
//   const { status, run, stop } = usePyodide()
//   status: 'loading' | 'ready' | 'running'
//   const { output, error, timedOut, stopped } = await run(code)
//   stop() ends a running program early (stopped: true)
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
        job.resolve({ output: job.output.join('\n'), error: msg.error, timedOut: false, stopped: false })
      }
    }
    workerRef.current = worker
  }, [])

  useEffect(() => {
    startWorker()
    return () => workerRef.current?.terminate() // page closed: stop the worker
  }, [startWorker])

  // Stop the program that is running: the only safe way is to fire this worker
  // and hire a fresh one. Returns the run's job so the caller can finish it.
  const killJob = useCallback(() => {
    const job = jobRef.current
    if (!job) return null
    clearTimeout(job.timer)
    jobRef.current = null
    workerRef.current.terminate()
    setStatus('loading') // the new worker needs a few seconds to load Python again
    startWorker()
    return job
  }, [startWorker])

  const run = useCallback((code) => {
    return new Promise((resolve) => {
      if (jobRef.current) return // one run at a time
      const id = nextId.current++
      const timer = setTimeout(() => {
        // Too slow: probably an infinite loop.
        const job = killJob()
        if (job) resolve({ output: job.output.join('\n'), error: TIMEOUT_ERROR, timedOut: true, stopped: false })
      }, RUN_TIMEOUT_MS)
      jobRef.current = { id, output: [], resolve, timer }
      setStatus('running')
      workerRef.current.postMessage({ id, code })
    })
  }, [killJob])

  // The kid pressed Stop: the run ends with what it printed so far and no error.
  const stop = useCallback(() => {
    const job = killJob()
    if (job) job.resolve({ output: job.output.join('\n'), error: '', timedOut: false, stopped: true })
  }, [killJob])

  return { status, run, stop }
}
