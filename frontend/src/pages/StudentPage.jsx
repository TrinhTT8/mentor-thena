import { useState } from 'react'
import { useParams } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import HealthCheck from '../components/HealthCheck.jsx'
import OutputBox from '../components/OutputBox.jsx'
import usePyodide from '../usePyodide.js'

// What the Run button says in each state.
const RUN_LABELS = {
  loading: 'Getting the ship ready...',
  ready: 'Run',
  running: 'Running...',
}

// Placeholder layout: task card, hint box and the pixel design come in B5/B6.
export default function StudentPage() {
  const { id } = useParams()
  const [code, setCode] = useState('print("Hello, Ithaca!")\n')
  const [result, setResult] = useState({ output: '', error: '' })
  const { status, run } = usePyodide()

  async function handleRun() {
    if (status !== 'ready') return
    const { output, error } = await run(code)
    setResult({ output, error })
    // B5: send this result to the server as a snapshot (event: "run").
  }

  // Ctrl+Enter (Cmd+Enter on Mac) runs the code. "Capture" catches the keys
  // before the editor uses them to add a new line.
  function handleKeyDownCapture(event) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      handleRun()
    }
  }

  return (
    <main className="student-page">
      <h1>Student {id}</h1>
      <HealthCheck />
      <div onKeyDownCapture={handleKeyDownCapture}>
        <CodeMirror value={code} height="200px" extensions={[python()]} onChange={setCode} />
      </div>
      <button type="button" className="run-button" onClick={handleRun} disabled={status !== 'ready'}>
        {RUN_LABELS[status]}
      </button>
      <OutputBox output={result.output} error={result.error} running={status === 'running'} />
    </main>
  )
}
