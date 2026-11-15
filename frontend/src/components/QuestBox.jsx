// The quest banner across the top: scroll icon, title, instructions, a progress badge,
// and (on the right) the teacher's example when the task has one.
//
// task comes from GET /api/task: { task_id, title, instructions } plus one OPTIONAL field
// the server does not send yet:
//   example: a teacher-written example. NEVER the expected output (that stays on the server).

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

      {task?.example && (
        <div className="quest-example">
          <span className="tag-label">Example</span>
          <pre>{task.example}</pre>
        </div>
      )}
    </section>
  )
}
