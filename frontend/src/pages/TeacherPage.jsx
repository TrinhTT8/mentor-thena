import Logo from '../components/Logo.jsx'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import TeacherMenu from '../components/TeacherMenu.jsx'
import { getInsight, getSeamap, resolveStudent } from '../api.js'

// The teacher dashboard ("Captain's log"): who needs help first, Tiresias's class tip,
// and every ship in the class. Refreshes every 3 seconds.
const POLL_MS = 3000
const MAX_LEVEL = 3

// Status language for the teacher (red is shown here, never to kids).
const STATUS = {
  red: { icon: '!', word: 'Needs you', ship: 'ship-red' },
  yellow: { icon: '?', word: 'Getting hints', ship: 'ship-helping' },
  green: { icon: '✓', word: 'Sailing', ship: 'ship-green' },
  ithaca: { icon: '★', word: 'At Ithaca', ship: 'ship-home' },
}
const STATUS_ORDER = ['red', 'yellow', 'green', 'ithaca']

// The line under the name for ships that are not stuck.
const STATUS_LINE = { green: 'Sailing smoothly', ithaca: 'Task complete' }

// What the queue says when a tab has no ships.
const EMPTY_TEXT = {
  all: 'No ships in this class yet.',
  red: 'Nobody needs you right now.',
  yellow: 'Nobody is getting hints right now.',
  green: 'No ships are sailing right now.',
  ithaca: 'No ships have reached Ithaca yet.',
}

// One filter tab above the queue: a status square, the word and the count.
function QueueTab({ id, label, count, filter, onPick }) {
  const active = filter === id
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`queue-tab${active ? ' is-active' : ''}`}
      onClick={() => onPick(id)}
    >
      {id !== 'all' && <span className={`status-square is-${id}`} aria-hidden="true" />}
      {label} <span className="queue-tab-count">{count}</span>
    </button>
  )
}

function minutesSince(iso, now) {
  if (!iso) return 0
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
}

function stuckText(iso, now) {
  const minutes = minutesSince(iso, now)
  return minutes < 1 ? 'stuck under 1 min' : `stuck ${minutes} min`
}

export default function TeacherPage() {
  const { classId } = useParams()
  const [seamap, setSeamap] = useState(null)
  const [insight, setInsight] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [offline, setOffline] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [helping, setHelping] = useState(null) // id of the ship being marked helped
  const [filter, setFilter] = useState('all') // queue tab: 'all' or a status

  const refresh = useCallback(async () => {
    const [map, tip] = await Promise.allSettled([getSeamap(classId), getInsight(classId)])
    if (map.status === 'fulfilled') {
      setSeamap(map.value)
      setUpdatedAt(Date.now())
      setOffline(false)
    } else {
      setOffline(true)
    }
    if (tip.status === 'fulfilled') setInsight(tip.value)
  }, [classId])

  // Load now, then every 3 s. A 1-second clock keeps "updated 3s ago" and stuck times fresh.
  useEffect(() => {
    const first = setTimeout(refresh, 0) // the first load right away
    const poll = setInterval(refresh, POLL_MS)
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearTimeout(first); clearInterval(poll); clearInterval(clock) }
  }, [refresh])

  async function markHelped(studentId) {
    setHelping(studentId)
    try {
      await resolveStudent(studentId)
      await refresh()
    } catch (err) {
      console.warn('Mark helped failed', err)
    } finally {
      setHelping(null)
    }
  }

  const students = seamap?.students ?? []
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, students.filter((x) => x.status === s).length]))

  // The queue: every ship, red first, then yellow, green and Ithaca; inside each group
  // the longest stuck comes first. The tabs above it filter by status.
  const sorted = [...students].sort((a, b) => {
    const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    if (byStatus !== 0) return byStatus
    return new Date(a.stuck_since ?? 0) - new Date(b.stuck_since ?? 0)
  })
  const queue = filter === 'all' ? sorted : sorted.filter((s) => s.status === filter)

  const secondsAgo = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null

  return (
    <div className="student-page teacher-page">
      <header className="top-bar teacher-bar">
        <div className="top-left">
          <Logo />
          <div className="class-label">
            <span className="class-kicker">Captain&apos;s Log</span>
            <span className="class-name">Class {classId}</span>
          </div>
          <Link to="/teacher" className="back-link">← Your classes</Link>
        </div>

        <div className="teacher-summary">
          <span className="updated" role="status">
            {offline ? 'Cannot reach the server' : secondsAgo === null ? 'Loading...' : `Updated ${secondsAgo}s ago`}
          </span>
          <TeacherMenu />
        </div>
      </header>

      <main className="teacher-main">
        {/* Left: every ship, filtered by the tabs */}
        <section className="help-queue" aria-labelledby="queue-title">
          <div className="section-heading">
            <h1 id="queue-title" className="section-title">Help queue</h1>
            <span className="section-note">Red first, then longest stuck</span>
          </div>

          <div className="queue-tabs" role="tablist" aria-label="Show ships by status">
            <QueueTab id="all" label="All" count={students.length} filter={filter} onPick={setFilter} />
            {STATUS_ORDER.map((s) => (
              <QueueTab key={s} id={s} label={STATUS[s].word} count={counts[s]} filter={filter} onPick={setFilter} />
            ))}
          </div>

          {queue.length === 0 ? (
            <p className="queue-empty">{EMPTY_TEXT[filter]}</p>
          ) : (
            <ul className="queue-list">
              {queue.map((s) => {
                const stuck = s.status === 'red' || s.status === 'yellow'
                return (
                  <li key={s.id} className={`queue-card is-${s.status}`}>
                    <img src={`/pixel/${STATUS[s.status].ship}.svg`} alt="" width="40" height="40" className="pixel-art" />
                    <div className="queue-body">
                      <div className="queue-name-row">
                        <span className="queue-name">{s.name}</span>
                        {/* The ship picture shows the status; screen readers get it as words */}
                        <span className="sr-only">{STATUS[s.status].word}</span>
                      </div>
                      <p className="queue-reason">{stuck ? (s.reason || 'Working it out') : STATUS_LINE[s.status]}</p>
                      {stuck && (
                        <div className="queue-meta">
                          <span className="mini-pips" aria-hidden="true">
                            {Array.from({ length: MAX_LEVEL }, (_, i) => (
                              <span key={i} className={`mini-pip${i < s.hint_level ? ' is-on' : ''}`} />
                            ))}
                          </span>
                          <span>Hint {s.hint_level} of {MAX_LEVEL} · {stuckText(s.stuck_since, now)}</span>
                        </div>
                      )}
                    </div>
                    {stuck && (
                      <button
                        type="button"
                        className="stone-button is-small"
                        onClick={() => markHelped(s.id)}
                        disabled={helping === s.id}
                      >
                        {helping === s.id ? 'Saving...' : 'Mark helped'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="teacher-side">
          <TiresiasPanel insight={insight} />
          <WholeClass students={students} counts={counts} stats={seamap?.stats} />
        </div>
      </main>

      <div className="shore-border" aria-hidden="true" />
    </div>
  )
}

// "1 student is" / "3 students are"
function studentsAre(count) {
  return count === 1 ? '1 student is' : `${count} students are`
}

// Tiresias, the seer: points out the class's weak spot (no lesson plan) plus one bar
// per concept. The counts come from /api/insight; its long "tip" text is not shown.
function TiresiasPanel({ insight }) {
  const counts = insight?.counts ?? []
  const most = Math.max(1, ...counts.map((c) => c.students))
  const top = counts[0]

  let vision = 'Reading the stars...'
  if (insight && !top) vision = 'Calm seas ahead. Nobody is stuck right now.'
  else if (top) vision = `${studentsAre(top.students)} stuck on ${top.concept}.`

  return (
    <section className="tiresias" aria-labelledby="tiresias-title">
      <div className="tiresias-heading">
        <img src="/pixel/tiresias-eye.svg" alt="" width="60" height="40" className="tiresias-eye pixel-art" />
        <h2 id="tiresias-title" className="tiresias-title">Tiresias foresees</h2>
      </div>
      <p className="tiresias-lead">Here is what Tiresias foresees in your class...</p>
      <p className="tiresias-tip">{vision}</p>
      {counts.length > 0 && (
        <ul className="concept-bars" aria-label="Students stuck per concept">
          {counts.map((c) => (
            <li key={c.concept} className="concept-row" title={`${c.concept}: ${c.students} stuck`}>
              <span className="concept-name">{c.concept}</span>
              <span className="concept-track">
                <span className="concept-fill" style={{ width: `${(c.students / most) * 100}%` }} />
              </span>
              <span className="concept-count">{c.students}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// Every ship: a status bar (red, yellow, green, Ithaca) and a grid of named ships.
function WholeClass({ students, counts, stats }) {
  const total = students.length
  return (
    <section className="whole-class" aria-labelledby="class-title">
      <div className="section-heading">
        <h2 id="class-title" className="section-title">Whole class</h2>
        <span className="section-note">{counts.ithaca} of {total} ships home</span>
      </div>

      {total > 0 && (
        <div className="class-bar" role="img" aria-label={STATUS_ORDER.map((s) => `${counts[s]} ${STATUS[s].word}`).join(', ')}>
          {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
            <span
              key={s}
              className={`class-bar-part is-${s}`}
              style={{ flexGrow: counts[s] }}
              title={`${STATUS[s].word}: ${counts[s]}`}
            />
          ))}
        </div>
      )}

      <ul className="ship-grid">
        {students.map((s) => (
          <li
            key={s.id}
            className="ship-cell"
            role="img"
            aria-label={`${s.name}, ${STATUS[s.status]?.word ?? s.status}${s.concept ? `: ${s.concept}` : ''}`}
            title={s.reason || STATUS[s.status]?.word}
          >
            <img src={`/pixel/${STATUS[s.status]?.ship ?? 'ship-green'}.svg`} alt="" width="48" height="48" className={`pixel-art${s.status === 'red' ? ' is-alert' : ''}`} />
            <span className="ship-name">{s.name}</span>
          </li>
        ))}
      </ul>

      {stats && (
        <p className="class-stats">
          Average time stuck: {Math.round(stats.avg_seconds_stuck / 60)} min · Siren Guard blocked {stats.siren_blocks} {stats.siren_blocks === 1 ? 'hint' : 'hints'}
        </p>
      )}
    </section>
  )
}
