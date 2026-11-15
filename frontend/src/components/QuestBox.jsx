// The quest box, styled like a game quest log: a parchment card in a wooden frame with
// a tab on top, a progress bar, and one quest row (scroll, details, status).
//
// task comes from GET /api/task: { task_id, title, instructions } plus one OPTIONAL field
// that the server does not send yet:
//   example: a teacher-written example (never the expected output!)

// progress: 'not-started' | 'in-progress' | 'completed'
const PROGRESS = {
  'not-started': { label: 'Not started', percent: 0 },
  'in-progress': { label: 'In progress', percent: 50 },
  completed: { label: 'Completed', percent: 100 },
}

export default function QuestBox({ task, progress }) {
  const step = PROGRESS[progress]

  return (
    <section className="quest-box" aria-labelledby="task-title">
      <div className="quest-tabs">
        <span className="quest-tab">Quest</span>
      </div>

      <div className="quest-frame">
        <div className="quest-progress">
          <div
            className="quest-bar"
            role="progressbar"
            aria-label="Quest progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={step.percent}
            aria-valuetext={step.label}
          >
            <div className="quest-bar-fill" style={{ width: `${step.percent}%` }} />
          </div>
          <span className="quest-progress-label">{step.label}</span>
        </div>

        <article className={`quest-item is-${progress}`}>
          <img src="/pixel/quest-scroll.svg" alt="" width="64" height="64" className="quest-icon pixel-art" />

          <div className="quest-body">
            <h1 id="task-title" className="quest-title">{task ? task.title : 'Loading your quest...'}</h1>
            {task && <p className="quest-description">{task.instructions}</p>}
            {task?.example && (
              <div className="quest-example">
                <span className="quest-example-label">Example</span>
                <pre>{task.example}</pre>
              </div>
            )}
          </div>

          <span className={`quest-status is-${progress}`}>
            {progress === 'completed' ? '✓ Completed' : step.label}
          </span>
        </article>
      </div>
    </section>
  )
}
