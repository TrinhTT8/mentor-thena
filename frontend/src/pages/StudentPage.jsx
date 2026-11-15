import Logo from '../components/Logo.jsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import OutputBox from '../components/OutputBox.jsx'
import AthenaPanel from '../components/AthenaPanel.jsx'
import QuestBox from '../components/QuestBox.jsx'
import MyShip from '../components/MyShip.jsx'
import Celebration from '../components/Celebration.jsx'
import DebugLine from '../components/DebugLine.jsx'
import usePyodide from '../usePyodide.js'
import { useActivity } from '../activity.js'
import { errorLineHighlight, errorLineNumber } from '../errorLine.js'
import { getStatus, getTask, sendSnapshot } from '../api.js'

const HEARTBEAT_MS = 10_000 // must match config.HEARTBEAT_SECONDS on the server
const MAX_EARLIER_HINTS = 2

// Athena's hints after the server answers: { current, earlier }.
// A new hint becomes current and the old one moves to "earlier".
// A green or Ithaca ship means the kid moved on, so all hints go away
// (the server's /status does the same). Yellow or red with no new hint: no change.
function nextHints(hints, reply) {
  if (reply.status === 'green' || reply.status === 'ithaca') return { current: null, earlier: [] }
  if (!reply.hint || reply.hint.text === hints.current?.text) return hints
  const earlier = hints.current ? [hints.current, ...hints.earlier] : hints.earlier
  return { current: reply.hint, earlier: earlier.slice(0, MAX_EARLIER_HINTS) }
}

// What the Run/Stop button says in each state. While code runs, it becomes Stop.
const RUN_LABELS = {
  loading: 'Getting ready...',
  ready: 'Run',
  running: 'Stop',
}

// The editor is the opposite of the page: dark on the cream "day" page, light on the navy "night" page.
const EDITOR_THEME = document.documentElement.dataset.theme === 'night' ? 'light' : 'dark'

// The code a quest starts with: just a comment with its title.
function starterCode(task) {
  return task ? `# ${task.title}\n` : ''
}

export default function StudentPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const debug = searchParams.has('debug')

  const [task, setTask] = useState(null)
  const [code, setCode] = useState('')
  const [result, setResult] = useState({ output: '', error: '', stopped: false })
  const [errorLine, setErrorLine] = useState(null) // the line to paint red, until the kid edits
  const [hints, setHints] = useState({ current: null, earlier: [] })
  const [thinking, setThinking] = useState(false)
  const [shipStatus, setShipStatus] = useState('green')
  const [celebrate, setCelebrate] = useState(false) // the Ithaca window
  const [bottomTab, setBottomTab] = useState('result') // 'result' | 'goal'
  const { status, run, stop } = usePyodide()
  const activity = useActivity()

  // The heartbeat timer reads these "boxes" so it always sends the newest code
  // and last run result without restarting every time the kid types.
  const codeRef = useRef(code)
  const resultRef = useRef(result)
  const runWaitingRef = useRef(false) // true while a Run is waiting for Athena

  function updateCode(value) {
    setCode(value)
    codeRef.current = value
  }

  // 1. Load the task and the ship's current status (so a page reload keeps the hint).
  useEffect(() => {
    let cancelled = false
    getTask(id)
      .then((t) => {
        if (cancelled) return
        setTask(t)
        if (!codeRef.current) updateCode(starterCode(t)) // start with the quest's comment
      })
      .catch((err) => console.warn('Could not load the task', err))
    getStatus(id)
      .then((reply) => {
        if (cancelled) return
        setShipStatus(reply.status)
        setHints({ current: reply.hint, earlier: [] })
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
        setHints((current) => nextHints(current, reply))
      } catch (err) {
        console.warn('Heartbeat failed', err)
      } finally {
        busy = false
      }
    }, HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [id, taskId, activity])

  function handleChange(value) {
    updateCode(value)
    setErrorLine(null) // the code changed, so the old red line may be in the wrong place
  }

  // Start the quest over (asks first, so a click by accident doesn't lose work).
  function handleReset() {
    if (!window.confirm('Start over? This clears your code.')) return
    updateCode(starterCode(task))
    setErrorLine(null)
  }

  // 3. Run: run Python in the browser, then send the result as a "run" snapshot.
  async function handleRun() {
    if (status !== 'ready') return
    setBottomTab('result')
    const { output, error, stopped } = await run(code)
    setResult({ output, error, stopped })
    setErrorLine(errorLineNumber(error))
    resultRef.current = { output, error }
    // A run the kid stopped on purpose is not sent: it isn't a real result for Argus.
    if (!task || stopped) return

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
      // Celebrate only the moment the ship arrives (not on every reload afterwards).
      if (reply.status === 'ithaca' && shipStatus !== 'ithaca') setCelebrate(true)
      setShipStatus(reply.status)
      setHints((current) => nextHints(current, reply))
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

  const editorExtensions = useMemo(() => [python(), errorLineHighlight(errorLine)], [errorLine])
  const running = status === 'running'

  // Quest progress: done at Ithaca; in progress once the kid has written or run something
  // (or Athena is already helping); otherwise not started.
  const wroteSomething = code.trim() !== '' && code !== starterCode(task)
  let questProgress = 'not-started'
  if (shipStatus === 'ithaca') questProgress = 'completed'
  else if (wroteSomething || result.output || result.error || shipStatus !== 'green') questProgress = 'in-progress'

  return (
    <div className="student-page">
      <header className="top-bar">
        <div className="top-left">
          <Logo />
          <Link to={`/student/${encodeURIComponent(id)}`} className="back-link">← Voyage map</Link>
        </div>
        <MyShip status={shipStatus} />
      </header>

      <main className="student-main">
        <QuestBox task={task} progress={questProgress} />

        {/* Left: the code box. Top: file tab, language, Reset. Bottom: Result/Goal tabs and Run. */}
        <section className="ide" aria-label="Your code">
          <div className="ide-bar">
            <div className="ide-file">
              <span className="ide-tab is-active">main.py</span>
              <span className="ide-chip">Python 3</span>
            </div>
            <button type="button" className="quiet-button" onClick={handleReset} disabled={running}>
              Reset
            </button>
          </div>

          <div className="ide-editor" onKeyDownCapture={handleKeyDownCapture}>
            <CodeMirror
              value={code}
              height="clamp(220px, 38vh, 520px)"
              theme={EDITOR_THEME}
              extensions={editorExtensions}
              onChange={handleChange}
              onUpdate={activity.onEditorUpdate}
              aria-label="Python code editor"
            />
          </div>

          <div className="ide-bar ide-bottom-bar">
            <div className="ide-tabs" role="tablist" aria-label="Result or goal">
              <button
                type="button"
                role="tab"
                aria-selected={bottomTab === 'result'}
                className={`ide-tab${bottomTab === 'result' ? ' is-active' : ''}`}
                onClick={() => setBottomTab('result')}
              >
                Result
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={bottomTab === 'goal'}
                className={`ide-tab${bottomTab === 'goal' ? ' is-active' : ''}`}
                onClick={() => setBottomTab('goal')}
              >
                Goal
              </button>
            </div>
            <div className="ide-actions">
              <span className="run-tip">Ctrl + Enter</span>
              <button
                type="button"
                className={`stone-button is-small${running ? '' : ' is-teal'}`}
                onClick={running ? stop : handleRun}
                disabled={status === 'loading'}
              >
                {RUN_LABELS[status]}
              </button>
            </div>
          </div>

          {bottomTab === 'result' ? (
            <OutputBox output={result.output} error={result.error} running={running} stopped={result.stopped} />
          ) : (
            <div className="goal-box">
              <p>{task ? task.instructions : 'Loading your quest...'}</p>
              {task?.example && <pre>{task.example}</pre>}
            </div>
          )}
        </section>

        <AthenaPanel
          hint={hints.current}
          earlierHints={hints.earlier}
          thinking={thinking}
          atIthaca={shipStatus === 'ithaca'}
          teacherComing={shipStatus === 'red'}
        />

        {debug && <DebugLine peek={activity.peek} />}
      </main>

      <Celebration open={celebrate} onClose={() => setCelebrate(false)} />

      {/* The rocky shore along the bottom of the page */}
      <div className="page-waves" aria-hidden="true" />
      <div className="shore-border" aria-hidden="true" />
    </div>
  )
}
