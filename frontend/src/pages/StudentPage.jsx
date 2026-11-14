import { useState } from 'react'
import { useParams } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { python } from '@codemirror/lang-python'
import HealthCheck from '../components/HealthCheck.jsx'

// Placeholder: real editor, Pyodide, and hint box come later.
export default function StudentPage() {
  const { id } = useParams()
  const [code, setCode] = useState('print("Hello, Ithaca!")\n')

  return (
    <main>
      <h1>Student {id}</h1>
      <HealthCheck />
      <CodeMirror value={code} height="200px" extensions={[python()]} onChange={setCode} />
    </main>
  )
}
