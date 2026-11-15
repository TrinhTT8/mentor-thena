import Logo from '../components/Logo.jsx'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { islandSpots, loadVoyage } from '../voyage.js'

// The student's home page: a voyage map of today's quests. Each quest is an island on a
// dotted route that ends at Ithaca. Clicking an island shows it in the quest card.
const STATUS_CHIPS = {
  completed: { text: '★ Done', tone: 'is-done' },
  current: { text: '▶ Today', tone: 'is-today' },
  locked: { text: 'Locked', tone: 'is-locked' },
}

const ISLAND_ART = {
  completed: 'island',
  locked: 'island-locked',
}

export default function HomePage() {
  const { id } = useParams()
  const [voyage, setVoyage] = useState(null)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState(null) // index of the island shown in the card

  useEffect(() => {
    let cancelled = false
    loadVoyage(id)
      .then((v) => { if (!cancelled) setVoyage(v) })
      .catch((err) => {
        console.warn('Could not load the voyage', err)
        if (!cancelled) setFailed(true)
      })
    return () => { cancelled = true }
  }, [id])

  const lessons = voyage?.lessons ?? []
  const spots = islandSpots(lessons.length)
  const currentIndex = Math.max(0, lessons.findIndex((l) => l.status === 'current'))
  const shownIndex = selected ?? currentIndex
  const shown = lessons[shownIndex]
  const done = lessons.filter((l) => l.status === 'completed').length
  const teacher = voyage?.teacherName ?? 'Your teacher'

  // Where the ship is: on today's quest, or (every quest done) sailing into Ithaca.
  const todayIndex = lessons.findIndex((l) => l.status === 'current')
  const allDone = lessons.length > 0 && done === lessons.length
  let ship = null
  if (allDone) {
    ship = { to: spots[lessons.length], from: spots[lessons.length - 1], arriving: true }
  } else if (todayIndex >= 0) {
    ship = { to: spots[todayIndex], from: spots[todayIndex], arriving: false }
  }
  const questWord = lessons.length === 1 ? 'quest' : 'quests'

  return (
    <div className="student-page home-page">
      <header className="top-bar">
        <Logo />
        <div className="home-top-right">
          {voyage?.className && (
            <span className="room-chip">
              {voyage.className}{voyage.teacherName ? ` · ${voyage.teacherName}` : ''}
            </span>
          )}
          <ProfileMenu name={voyage?.studentName} className={voyage?.className} teacherName={voyage?.teacherName} />
        </div>
      </header>

      <main className="home-main">
        <div className="greeting">
          {/* "Ahoy, Maya!" once the name arrives; until then (or if it never does) say so */}
          <h1 className="greeting-title">
            {voyage?.studentName ? `Ahoy, ${voyage.studentName}!` : 'Loading name...'}
          </h1>
          <p className="greeting-sub">
            {voyage
              ? `${teacher} charted ${lessons.length} ${questWord} for today. Sail to every island to reach Ithaca!`
              : failed ? 'We could not reach the harbor. Ask your teacher for help.' : 'Charting your voyage...'}
          </p>
        </div>

        <div className="home-grid">
          {/* The map */}
          <section className="voyage-map" aria-label="Today's voyage map">
            <div className="map-badge">
              <span className="map-badge-title">Today&apos;s voyage</span>
              <span>{done} of {lessons.length} islands visited</span>
            </div>

            <div className="map-sea">
              {/* Three lines of pixel foam across the sea */}
              <span className="map-wave" style={{ top: '22%' }} aria-hidden="true" />
              <span className="map-wave" style={{ top: '52%' }} aria-hidden="true" />
              <span className="map-wave" style={{ top: '84%' }} aria-hidden="true" />

              {/* The dotted route through every island to Ithaca */}
              {lessons.length > 0 && (
                <svg className="map-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <polyline points={spots.map((s) => `${s.x},${s.y}`).join(' ')} />
                </svg>
              )}

              <ol className="map-stops">
                {lessons.map((lesson, i) => {
                  const chip = STATUS_CHIPS[lesson.status]
                  return (
                    <li
                      key={lesson.task_id}
                      className={`map-stop is-${lesson.status}${i === shownIndex ? ' is-selected' : ''}`}
                      style={{ '--x': `${spots[i].x}%`, '--y': `${spots[i].y}%` }}
                    >
                      <button
                        type="button"
                        className="map-stop-button"
                        onClick={() => setSelected(i)}
                        aria-label={`Quest ${i + 1}: ${lesson.title}. ${chip.text.replace(/[★▶] /, '')}`}
                        aria-pressed={i === shownIndex}
                      >
                        {/* The quest the kid is on now shows only their ship (drawn below, on its own
                            layer); an invisible island keeps the label in the same place */}
                        <img
                          src={`/pixel/${ISLAND_ART[lesson.status] ?? 'island'}.svg`}
                          alt=""
                          width="100"
                          height="65"
                          className={`map-island pixel-art${lesson.status === 'current' ? ' is-placeholder' : ''}`}
                        />
                        {lesson.status === 'completed' && (
                          <img src="/pixel/sparkle.svg" alt="" width="16" height="16" className="map-sparkle pixel-art" />
                        )}
                        <span className="map-label">
                          <span className="map-label-number">Quest {i + 1}</span>
                          <span className="map-label-title">{lesson.title}</span>
                          <span className={`map-chip ${chip.tone}`}>{chip.text}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}

                {lessons.length > 0 && (
                  <li
                    className="map-stop is-ithaca"
                    style={{ '--x': `${spots[lessons.length].x}%`, '--y': `${spots[lessons.length].y}%` }}
                  >
                    <div className="map-stop-button" aria-label="Ithaca, the end of the voyage">
                      <img src="/pixel/island-ithaca.svg" alt="" width="100" height="65" className="map-island pixel-art" />
                      <span className="map-ithaca-label">Ithaca</span>
                    </div>
                  </li>
                )}
              </ol>

              {/* The kid's ship. It sits on today's quest; when every quest is done it sails
                  from the last island to Ithaca and docks beside it. */}
              {ship && (
                <div
                  className={`voyage-ship${ship.arriving ? ' is-arriving' : ''}`}
                  style={{
                    '--x': `${ship.to.x}%`,
                    '--y': `${ship.to.y}%`,
                    '--from-x': `${ship.from.x}%`,
                    '--from-y': `${ship.from.y}%`,
                  }}
                  aria-hidden="true"
                >
                  <img
                    src={`/pixel/${ship.arriving ? 'ship-home' : 'ship-green'}.svg`}
                    alt=""
                    width="72"
                    height="72"
                    className="map-ship pixel-art"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Right column: the chosen quest and the logbook */}
          <div className="home-side">
            <QuestCard id={id} lesson={shown} index={shownIndex} total={lessons.length} />
            <Logbook stars={done} visited={done} total={lessons.length} streak={voyage?.streak} />
          </div>
        </div>
      </main>

      <div className="shore-border" aria-hidden="true" />
    </div>
  )
}

// The quest card on the right, with Athena peeking over the top.
function QuestCard({ id, lesson, index, total }) {
  if (!lesson) {
    return <section className="home-quest"><p className="quest-description">Loading your quest...</p></section>
  }
  const questLink = `/student/${encodeURIComponent(id)}/quest`
  const locked = lesson.status === 'locked'
  const done = lesson.status === 'completed'

  // Athena sits just OUTSIDE the card (in the wrapper), so the card's stepped
  // corners don't cut her off while she peeks over the top edge.
  return (
    <div className="peek-wrap">
    <img src="/pixel/athena-owl.svg" alt="" width="56" height="56" className="peek-owl pixel-art" />
    <section className="home-quest" aria-labelledby="home-quest-title">
      <span className="tag-label">Quest {index + 1} of {total}</span>
      <h2 id="home-quest-title" className="quest-title">{lesson.title}</h2>
      {lesson.skill && <span className="skill-chip">Skill: {lesson.skill}</span>}
      <p className="quest-description">{lesson.instructions}</p>
      {locked ? (
        <p className="locked-note">This island is still in the mist. Finish the quests before it to sail here!</p>
      ) : (
        <Link to={questLink} className="stone-button is-gold set-sail">
          {done ? 'Sail again' : 'Set sail!'}
        </Link>
      )}
    </section>
    </div>
  )
}

// Small stats: stars, islands, and the day streak (only when the server sends it).
function Logbook({ stars, visited, total, streak }) {
  return (
    <section className="logbook" aria-labelledby="logbook-title">
      <h2 id="logbook-title" className="section-title">Your logbook</h2>
      <div className="logbook-stats">
        <div className="logbook-stat">
          <img src="/pixel/star.svg" alt="" width="28" height="28" className="pixel-art" />
          <strong>{stars}</strong>
          <span className="sr-only">{stars === 1 ? 'star' : 'stars'}</span>
        </div>
        <div className="logbook-stat">
          <img src="/pixel/island.svg" alt="" width="40" height="26" className="pixel-art" />
          <strong>{visited}/{total}</strong>
          <span className="sr-only">islands visited</span>
        </div>
        {streak != null && (
          <div className="logbook-stat">
            <img src="/pixel/sparkle.svg" alt="" width="24" height="24" className="pixel-art" />
            <strong>{streak}</strong>
            <span className="sr-only">day streak</span>
          </div>
        )}
      </div>
    </section>
  )
}

// The kid's button in the top right: owl avatar + name. Opens a card with Log out.
function ProfileMenu({ name, className, teacherName }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  // Close when clicking anywhere else or pressing Esc.
  useEffect(() => {
    if (!open) return
    function onPointer(event) {
      if (!menuRef.current?.contains(event.target)) setOpen(false)
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const shownName = name ?? 'Loading name...'
  return (
    <div className="profile" ref={menuRef}>
      <button
        type="button"
        className="profile-button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="profile-avatar">
          <img src="/pixel/athena-owl.svg" alt="" width="28" height="28" className="pixel-art" />
        </span>
        <span className="profile-name">{shownName}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="profile-card">
          <span className="profile-avatar is-big">
            <img src="/pixel/athena-owl.svg" alt="" width="56" height="56" className="pixel-art" />
          </span>
          <p className="profile-card-name">{shownName}</p>
          {className && <p className="profile-card-room">{className}{teacherName ? ` · ${teacherName}` : ''}</p>}
          <button type="button" className="stone-button is-small" onClick={() => navigate('/')}>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
