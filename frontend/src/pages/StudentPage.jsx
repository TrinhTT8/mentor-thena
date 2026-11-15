import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
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

// What the Run/Stop button says in each state. While code runs, it becomes Stop.
const RUN_LABELS = {
  loading: 'Getting ready...',
  ready: 'Run',
  running: 'Stop',
}

// The editor is the opposite of the page: black on the cream "day" page, cream on the navy "night" page.
const EDITOR_THEME = document.documentElement.dataset.theme === 'night' ? 'light' : 'dark'

// Placeholder layout: the pixel design comes in B6.
export default function StudentPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const debug = searchParams.has('debug')

  const [task, setTask] = useState(null)
  const [code, setCode] = useState('')
  const [result, setResult] = useState({ output: '', error: '', stopped: false })
  const [hint, setHint] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [shipStatus, setShipStatus] = useState('green')
  const [celebrate, setCelebrate] = useState(false) // the Ithaca window
  const { status, run, stop } = usePyodide()
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
    const { output, error, stopped } = await run(code)
    setResult({ output, error, stopped })
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

  const running = status === 'running'

  // Quest progress: done at Ithaca; in progress once the kid has written or run something
  // (or Athena is already helping); otherwise not started.
  let questProgress = 'not-started'
  if (shipStatus === 'ithaca') questProgress = 'completed'
  else if (code.trim() || result.output || result.error || shipStatus !== 'green') questProgress = 'in-progress'

  return (
    <div className="student-page">
      <header className="top-bar">
        <p className="logo">MentorThena</p>
        <MyShip status={shipStatus} />
      </header>

      <main className="student-main">
        {/* Row 1: the quest box */}
        <QuestBox task={task} progress={questProgress} />

        {/* Left column: one code box like LeetCode: toolbar, editor, then the Output tab */}
        <section className="ide" aria-label="Your code">
          <div className="ide-bar">
            <span className="ide-language">Python</span>
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

          <div className="ide-editor" onKeyDownCapture={handleKeyDownCapture}>
            <CodeMirror
              value={code}
              height="clamp(280px, 48vh, 600px)"
              theme={EDITOR_THEME}
              extensions={[python()]}
              onChange={handleChange}
              onUpdate={activity.onEditorUpdate}
              aria-label="Python code editor"
            />
          </div>

          <div className="ide-bar ide-tabs">
            <h2 className="ide-tab">Output</h2>
            <OutputSummary result={result} running={running} atIthaca={shipStatus === 'ithaca'} />
          </div>
          <OutputBox output={result.output} error={result.error} running={running} stopped={result.stopped} />
        </section>

        {/* Right column: Athena */}
        <AthenaPanel
          hint={hint}
          thinking={thinking}
          atIthaca={shipStatus === 'ithaca'}
          teacherComing={shipStatus === 'red'}
        />

        {debug && <DebugLine peek={activity.peek} />}
      </main>

      <Celebration open={celebrate} onClose={() => setCelebrate(false)} />

      {/* The sea along the bottom of the page */}
      <div className="sea" aria-hidden="true">
        <div className="wave-border" />
      </div>
    </div>
  )
}

// The short result line on the right of the Output tab, like LeetCode's "Accepted".
function OutputSummary({ result, running, atIthaca }) {
  let text = null
  let tone = ''
  if (running) text = 'Running...'
  else if (result.error) { text = 'Python found a problem'; tone = 'is-problem' }
  else if (result.stopped) text = 'Stopped'
  else if (atIthaca) { text = 'Quest complete!'; tone = 'is-done' }
  else if (result.output) text = 'Ran with no errors'
  if (!text) return null
  return <span className={`output-summary ${tone}`}>{text}</span>
}
