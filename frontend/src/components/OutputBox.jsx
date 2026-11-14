// Shows what the student's program printed, or a friendly version of the error.
// Styling is temporary; B6 applies the pixel design system.
export default function OutputBox({ output, error, running }) {
  let body
  if (running) {
    body = <span className="output-empty">Running your code...</span>
  } else if (error) {
    body = (
      <>
        {output && <span>{output}{'\n\n'}</span>}
        <span className="output-lead">Oops! Python found a problem:</span>
        <span className="output-error">{error}</span>
      </>
    )
  } else if (output) {
    body = output
  } else {
    body = <span className="output-empty">Press Run to see what your code does.</span>
  }

  // aria-live: screen readers announce new output automatically
  return <pre className="output-box" aria-live="polite">{body}</pre>
}
