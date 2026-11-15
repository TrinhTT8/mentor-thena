// The quest banner across the top: scroll icon, title, instructions and a progress badge.
// task comes from GET /api/task: { task_id, title, instructions }.

const PROGRESS_LABELS = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  completed: '✓ Completed',
}

// Words in `backticks` show as little code chips, like `print`.
function withCodeChips(text) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') && part.endsWith('`')
      ? <code key={i} className="code-chip">{part.slice(1, -1)}</code>
      : part,
  )
}

export default function QuestBox({ task, progress }) {
  return (
    <section className="quest-banner" aria-labelledby="task-title">
      <img src="/pixel/quest-scroll.svg" alt="" width="56" height="56" className="quest-icon pixel-art" />

      <div className="quest-body">
        <div className="quest-heading">
          <h1 id="task-title" className="quest-title">{task ? task.title : 'Loading your quest...'}</h1>
          <span className={`quest-status is-${progress}`}>{PROGRESS_LABELS[progress]}</span>
        </div>
        {task && <p className="quest-description">{withCodeChips(task.instructions)}</p>}
      </div>
    </section>
  )
}
