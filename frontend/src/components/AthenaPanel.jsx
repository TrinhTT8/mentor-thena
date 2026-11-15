const MAX_LEVEL = 3

// The right-hand panel: Athena the owl and her speech bubble.
// The hint object only has level, text and from_ships_log (reason/concept are teacher-only).
// teacherComing: the ship is red (Athena gave all 3 hints), so the teacher was told.
export default function AthenaPanel({ hint, thinking, atIthaca, teacherComing }) {
  let bubble
  if (atIthaca) {
    bubble = <p className="hint-text">You reached Ithaca! Great sailing, your code works!</p>
  } else if (thinking) {
    bubble = <p className="hint-text">Athena is thinking<span className="thinking-dots" aria-hidden="true" /></p>
  } else if (hint) {
    bubble = (
      <>
        <p className="hint-text">{hint.text}</p>
        <HintPips level={hint.level} />
      </>
    )
  } else {
    bubble = <p className="hint-idle">Write your code and press Run. I am here if you need help!</p>
  }

  return (
    <aside className="panel athena-panel" aria-labelledby="athena-title">
      <h2 id="athena-title" className="panel-title">Athena</h2>
      <img
        src="/pixel/athena-owl.svg"
        alt="Athena the owl"
        width="96"
        height="96"
        className={`athena-owl pixel-art${thinking ? ' is-thinking' : ''}`}
      />
      {teacherComing && !atIthaca && (
        <p className="teacher-note" role="status">Your teacher is coming to help! Keep trying while you wait.</p>
      )}
      {/* key: a new hint remounts the bubble so it pops in again */}
      <div key={hint?.text ?? (thinking ? 'thinking' : 'idle')} className="hint-bubble" aria-live="polite">
        {bubble}
      </div>
    </aside>
  )
}

// Three square pips: how many hints Athena has given for this problem.
function HintPips({ level }) {
  return (
    <div className="hint-pips">
      <span className="sr-only">Hint {level} of {MAX_LEVEL}</span>
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <span key={i} className={`hint-pip${i < level ? ' is-on' : ''}`} aria-hidden="true" />
      ))}
    </div>
  )
}
