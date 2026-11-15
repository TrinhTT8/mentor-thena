import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import OutputBox from '../components/OutputBox.jsx'
import HintBox from '../components/HintBox.jsx'
import DebugLine from '../components/DebugLine.jsx'
import usePyodide from '../usePyodide.js'
import { useActivity } from '../activity.js'
import { getTask, sendSnapshot } from '../api.js'

const HEARTBEAT_MS = 10_000 // must match config.HEARTBEAT_SECONDS on the server

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
  const { status, run } = usePyodide()
  const activity = useActivity()

  // The heartbeat timer reads these "boxes" so it always sends the newest code
  // and last run result without restarting every time the kid types.
  const codeRef = useRef(code)
  const resultRef = useRef(result)

  // 1. Load the student's task (title + instructions) when the page opens.
  useEffect(() => {
    let cancelled = false
    getTask(id)
      .then((t) => { if (!cancelled) setTask(t) })
      .catch((err) => console.warn('Could not load the task', err))
    return () => { cancelled = true }
  }, [id])

  // 2. Heartbeat: every 10 s tell the server how the kid is doing.
  const taskId = task?.task_id
  useEffect(() => {
    if (!taskId) return
    let busy = false // skip a beat if the last one is still waiting for Athena
    const timer = setInterval(async () => {
      if (busy) return
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
        if (reply.hint) setHint(reply.hint)
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
    try {
      const reply = await sendSnapshot({
        student_id: id,
        task_id: task.task_id,
        event: 'run',
        code,
        output,
        error,
      })
      if (reply.hint) setHint(reply.hint)
    } catch (err) {
      console.warn('Run snapshot failed', err) // the kid still sees their output
    } finally {
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
      <HintBox hint={hint} thinking={thinking} />
      {debug && <DebugLine peek={activity.peek} />}
    </main>
  )
}
