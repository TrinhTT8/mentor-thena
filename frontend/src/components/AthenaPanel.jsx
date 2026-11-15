const MAX_LEVEL = 3

// Argus, Odysseus's loyal dog, sits at the bottom of the panel. He is the one who
// "spots trouble" (on the server, Argus is the part that notices a stuck kid),
// so his line follows what is happening. He naps until the coder needs help.
// mood: 'asleep' | 'awake' | 'alert' (shows "!") | 'happy' (fast wag)
function argusSays({ atIthaca, teacherComing, thinking, hint, hasError }) {
  if (atIthaca) return { mood: 'happy', line: 'Woof woof! You did it!' }
  if (teacherComing) return { mood: 'alert', line: 'Woof! I barked for your teacher. Help is on the way!' }
  if (thinking) return { mood: 'awake', line: 'Woof! I am fetching Athena.' }
  if (hint?.level === 3) return { mood: 'alert', line: 'Woof! I spotted trouble, so Athena sent her scroll.' }
  if (hint) return { mood: 'alert', line: 'Woof! I spotted trouble, so Athena sent a hint.' }
  if (hasError) return { mood: 'asleep', line: "Zzz... keep going, I'm right here." }
  return { mood: 'asleep', line: "Zzz... napping. I'll wake up if you need help." }
}

// The right-hand panel: Athena (an owl) with her current hint and earlier hints,
// and Argus the dog at the bottom.
// Hints only have level, text and from_ships_log (reason/concept are teacher-only).
//   hint:          the newest hint, or null
//   earlierHints:  hints she gave before this one (newest first)
//   teacherComing: the ship is red (all 3 hints used), so the teacher was told
//   hasError:      the last run had a Python error
export default function AthenaPanel({ hint, earlierHints, thinking, atIthaca, teacherComing, hasError }) {
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

  const argus = argusSays({ atIthaca, teacherComing, thinking, hint, hasError })

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

      {/* Argus: asleep (with "z Z") until help is needed, then standing with a wagging tail.
          Only the tail moves. The "!" mark shows when he spots trouble. */}
      <div className={`argus is-${argus.mood}`}>
        <div className="argus-art" aria-hidden="true">
          {argus.mood === 'asleep' ? (
            <>
              <img src="/pixel/argus-sleep.svg" alt="" width="96" height="36" className="argus-sleep pixel-art" />
              <span className="argus-zzz">z Z</span>
            </>
          ) : (
            <>
              {argus.mood === 'alert' && <span className="argus-mark">!</span>}
              <img src="/pixel/argus-tail.svg" alt="" width="24" height="24" className="argus-tail pixel-art" />
              <img src="/pixel/argus-stand.svg" alt="" width="96" height="68" className="argus-stand pixel-art" />
            </>
          )}
        </div>
        <div className="argus-words" aria-live="polite">
          <span className="argus-name">Argus</span>
          <p className="argus-line">{argus.line}</p>
        </div>
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
