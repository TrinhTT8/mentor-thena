import { Decoration, EditorView } from '@codemirror/view'

// Find which line of the kid's code an error points at.
// Pyodide errors say "line 2" (sometimes several times; the last one is the real spot).
export function errorLineNumber(error) {
  if (!error) return null
  const matches = [...error.matchAll(/line (\d+)/g)]
  if (matches.length === 0) return null
  return Number(matches[matches.length - 1][1])
}

// A CodeMirror extension that paints one line red (class "cm-error-line"), or nothing.
export function errorLineHighlight(lineNumber) {
  return EditorView.decorations.of((view) => {
    if (!lineNumber || lineNumber > view.state.doc.lines) return Decoration.none
    const line = view.state.doc.line(lineNumber)
    return Decoration.set([Decoration.line({ class: 'cm-error-line' }).range(line.from)])
  })
}
