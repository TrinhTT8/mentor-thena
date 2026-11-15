import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import OutputBox from '../components/OutputBox.jsx'
import HintBox from '../components/HintBox.jsx'
import DebugLine from '../components/DebugLine.jsx'
import usePyodide from '../usePyodide.js'
import { useActivity } from '../activity.js'
import { getStatus, getTask, sendSnapshot } from '../api.js'

const HEARTBEAT_MS = 10_000 // must match config.HEARTBEAT_SECONDS on the server

// Which hint to show after the server answers.
// A new hint replaces the old one. A green or Ithaca ship means the kid moved on,
// so the old hint goes away (the server's /status does the same).
// Yellow or red with no new hint: keep showing the last hint.
function nextHint(currentHint, reply) {
  if (reply.hint) return reply.hint
  if (reply.status === 'green' || reply.status === 'ithaca') return null
  return currentHint
}

// What the Run button says in each state.
const RUN_LABELS = {
  loading: 'Getting the ship ready...',
  ready: 'Run',
  running: 'Running...',
}

// Placeholder layout: the pixel design comes in B6.
export default function StudentPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const debug = searchParams.has('debug')

  const [task, setTask] = useState(null)
  const [code, setCode] = useState('')
  const [result, setResult] = useState({ output: '', error: '' })
  const [hint, setHint] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [shipStatus, setShipStatus] = useState('green')
  const { status, run } = usePyodide()
  const activity = useActivity()

  // The heartbeat timer reads these "boxes" so it always sends the newest code
  // and last run result without restarting every time the kid types.
  const codeRef = useRef(code)
  const resultRef = useRef(result)
  const runWaitingRef = useRef(false) // true while a Run is waiting for Athena

  // 1. Load the task and the ship's current status (so a page reload keeps the hint).
  useEffect(() => {
    let cancelled = false
    getTask(id)
      .then((t) => { if (!cancelled) setTask(t) })
      .catch((err) => console.warn('Could not load the task', err))
    getStatus(id)
      .then((reply) => {
        if (cancelled) return
        setShipStatus(reply.status)
        setHint(reply.hint)
      })
      .catch((err) => console.warn('Could not load the status', err))
    return () => { cancelled = true }
  }, [id])

  // 2. Heartbeat: every 10 s tell the server how the kid is doing.
  const taskId = task?.task_id
  useEffect(() => {
    if (!taskId) return
    let busy = false // skip a beat if the last one is still waiting for Athena
    const timer = setInterval(async () => {
      // Skip while a heartbeat or a Run is still waiting, so the server never
      // works on two requests for this kid at once (that could give 2 hints).
      if (busy || runWaitingRef.current) return
      busy = true
      try {
        const reply = await sendSnapshot({
          student_id: id,
          task_id: taskId,
          event: 'heartbeat',
          code: codeRef.current,
          output: resultRef.current.output,
          error: resultRef.current.error,
          activity: activity.take(), // keys since the previous heartbeat, then reset
        })
        setShipStatus(reply.status)
        setHint((current) => nextHint(current, reply))
      } catch (err) {
        console.warn('Heartbeat failed', err)
      } finally {
        busy = false
      }
    }, HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [id, taskId, activity])

  function handleChange(value) {
    setCode(value)
    codeRef.current = value
  }

  // 3. Run: run Python in the browser, then send the result as a "run" snapshot.
  async function handleRun() {
    if (status !== 'ready') return
    const { output, error } = await run(code)
    setResult({ output, error })
    resultRef.current = { output, error }
    if (!task) return

    setThinking(true)
    runWaitingRef.current = true
    try {
      const reply = await sendSnapshot({
        student_id: id,
        task_id: task.task_id,
        event: 'run',
        code,
        output,
        error,
      })
      setShipStatus(reply.status)
      setHint((current) => nextHint(current, reply))
    } catch (err) {
      console.warn('Run snapshot failed', err) // the kid still sees their output
    } finally {
      runWaitingRef.current = false
      setThinking(false)
    }
  }

  // Count every key for Argus, and make Ctrl+Enter (Cmd+Enter on Mac) run the code.
  // "Capture" catches the keys before the editor uses them to add a new line.
  function handleKeyDownCapture(event) {
    activity.onKeyDown(event)
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      handleRun()
    }
  }

  return (
    <main className="student-page">
      <section className="task-card">
        <h1>{task ? task.title : 'Loading your quest...'}</h1>
        {task && <p>{task.instructions}</p>}
      </section>
      <div onKeyDownCapture={handleKeyDownCapture}>
        <CodeMirror
          value={code}
          height="200px"
          extensions={[python()]}
          onChange={handleChange}
          onUpdate={activity.onEditorUpdate}
        />
      </div>
      <button type="button" className="run-button" onClick={handleRun} disabled={status !== 'ready'}>
        {RUN_LABELS[status]}
      </button>
      <OutputBox output={result.output} error={result.error} running={status === 'running'} />
      {shipStatus === 'ithaca'
        ? <div className="ithaca-box">You reached Ithaca! Great sailing, your code works!</div>
        : <HintBox hint={hint} thinking={thinking} />}
      {debug && <DebugLine peek={activity.peek} />}
    </main>
  )
}
