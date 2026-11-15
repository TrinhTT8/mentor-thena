const MAX_LEVEL = 3

// A friendly line at the bottom of Athena's panel, matched to what is happening.
const TIPS = {
  idle: 'Every program starts small. One line that works is a great first step!',
  hint: 'Coders fix things one small change at a time. Try one idea, then press Run!',
  teacher: 'Asking for help is what great sailors do. Keep trying while you wait!',
  ithaca: 'You did it! Read your code once more and see how it works.',
}

// The right-hand panel: Athena (an owl) with her current hint, earlier hints and a tip.
// Hints only have level, text and from_ships_log (reason/concept are teacher-only).
//   hint:          the newest hint, or null
//   earlierHints:  hints she gave before this one (newest first)
//   teacherComing: the ship is red (all 3 hints used), so the teacher was told
export default function AthenaPanel({ hint, earlierHints, thinking, atIthaca, teacherComing }) {
  let card
  if (atIthaca) {
    card = (
      <div className="hint-card is-done">
        <p className="hint-text">You reached Ithaca! Great sailing, your code works!</p>
      </div>
    )
  } else if (thinking) {
    card = (
      <div className="hint-card is-thinking">
        <p className="hint-text">Athena is thinking<span className="thinking-dots" aria-hidden="true" /></p>
      </div>
    )
  } else if (hint) {
    card = (
      <div className="hint-card is-hint">
        <p className="hint-text">{hint.text}</p>
        <HintPips level={hint.level} />
      </div>
    )
  } else {
    card = (
      <div className="hint-card is-idle">
        <p className="hint-idle">Write your code and press Run. I am here if you need help!</p>
      </div>
    )
  }

  let tip = TIPS.idle
  if (atIthaca) tip = TIPS.ithaca
  else if (teacherComing) tip = TIPS.teacher
  else if (hint) tip = TIPS.hint

  return (
    <aside className="athena-panel" aria-labelledby="athena-title">
      <div className="athena-header">
        <img
          src="/pixel/athena-owl.svg"
          alt=""
          width="64"
          height="64"
          className={`athena-owl pixel-art${thinking ? ' is-thinking' : ''}`}
        />
        <div>
          <h2 id="athena-title" className="athena-name">Athena</h2>
          <p className="athena-role">Your wise coding guide</p>
        </div>
      </div>

      {teacherComing && !atIthaca && (
        <p className="teacher-note">Your teacher is coming to help!</p>
      )}

      {/* key: a new hint remounts the card so it pops in again */}
      <div key={hint?.text ?? (thinking ? 'thinking' : 'idle')} className="hint-slot" aria-live="polite">
        {card}
      </div>

      {!atIthaca && earlierHints.length > 0 && (
        <div className="earlier-hints">
          <span className="tag-label">{earlierHints.length === 1 ? 'Earlier hint' : 'Earlier hints'}</span>
          {earlierHints.map((old) => (
            <p key={old.text} className="earlier-hint">{old.text}</p>
          ))}
        </div>
      )}

      <div className="athena-tip">
        <img src="/pixel/star.svg" alt="" width="22" height="22" className="pixel-art" />
        <p>{tip}</p>
      </div>
    </aside>
  )
}

// Three square pips plus "Hint 2 of 3": how many hints Athena has given for this problem.
function HintPips({ level }) {
  return (
    <div className="hint-pips">
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <span key={i} className={`hint-pip${i < level ? ' is-on' : ''}`} aria-hidden="true" />
      ))}
      <span className="hint-count">Hint {level} of {MAX_LEVEL}</span>
    </div>
  )
}
