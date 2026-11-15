import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import TeacherMenu from '../components/TeacherMenu.jsx'
import { getSeamap } from '../api.js'
import { DEMO_CLASSES, QUEST_LIBRARY, SKILLS } from '../teacherDemo.js'
import { hasQuests, loadVoyages, markSetSail, saveVoyages, shipsReady } from '../voyageStore.js'

// The teacher's home page: their classes on the left, the chosen class's banner,
// today's voyage (the quests students sail, in order) and the quest library.
// Class lists, the library and assigning are DEMO data for now (see teacherDemo.js);
// the live counts come from each class's Sea Map. The voyages are saved in voyageStore.js.
const POLL_MS = 5000

const questById = Object.fromEntries(QUEST_LIBRARY.map((q) => [q.id, q]))

export default function TeacherHome() {
  const [classId, setClassId] = useState(DEMO_CLASSES[0].id)
  const [voyages, setVoyages] = useState(loadVoyages)
  const [skill, setSkill] = useState('All')
  const [live, setLive] = useState({}) // live counts per class: { c1: { red, yellow, students } }
  const [note, setNote] = useState('')
  const [now, setNow] = useState(() => Date.now()) // updated with each poll, for the 15 s set-sail wait

  // Live "needs you / getting hints" counts for every class (a class the server
  // doesn't know yet just shows no chips).
  useEffect(() => {
    let cancelled = false
    async function refresh() {
      const results = await Promise.allSettled(DEMO_CLASSES.map((c) => getSeamap(c.id)))
      if (cancelled) return
      const next = {}
      results.forEach((result, i) => {
        if (result.status !== 'fulfilled') return
        const ships = result.value.students
        const count = (status) => ships.filter((s) => s.status === status).length
        next[DEMO_CLASSES[i].id] = { red: count('red'), yellow: count('yellow'), students: ships.length }
      })
      setLive(next)
      setNow(Date.now())
    }
    const first = setTimeout(refresh, 0)
    const timer = setInterval(refresh, POLL_MS)
    return () => { cancelled = true; clearTimeout(first); clearInterval(timer) }
  }, [])

  function updateVoyage(change) {
    setVoyages((all) => {
      const next = { ...all, [classId]: change(all[classId] ?? []) }
      saveVoyages(next)
      return next
    })
  }

  const assign = (questId) => {
    if (!hasQuests(voyages, classId)) markSetSail(classId) // the first quest: start the 15 s wait
    updateVoyage((list) => (list.includes(questId) ? list : [...list, questId]))
  }
  const remove = (questId) => updateVoyage((list) => list.filter((id) => id !== questId))
  const moveUp = (index) => updateVoyage((list) => {
    if (index === 0) return list
    const copy = [...list]
    ;[copy[index - 1], copy[index]] = [copy[index], copy[index - 1]]
    return copy
  })

  const current = DEMO_CLASSES.find((c) => c.id === classId) ?? DEMO_CLASSES[0]
  const voyage = (voyages[classId] ?? []).filter((id) => questById[id])
  const studentCount = live[current.id]?.students ?? current.students
  const shownSkills = skill === 'All' ? SKILLS : [skill]

  return (
    <div className="student-page teacher-home">
      <header className="top-bar teacher-bar">
        <div className="top-left">
          <Logo />
        </div>
        <div className="teacher-summary">
          <TeacherMenu />
        </div>
      </header>

      <main className="th-main">
        {/* Left: the teacher's classes */}
        <aside className="th-classes" aria-labelledby="classes-title">
          <h1 id="classes-title" className="section-title">Your classes</h1>
          <ul className="class-list">
            {DEMO_CLASSES.map((c) => {
              // No quests assigned = nobody is sailing yet, so no "needs you / getting hints" chips.
              const counts = shipsReady(voyages, c.id, now) ? live[c.id] : null
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`class-card${c.id === classId ? ' is-selected' : ''}`}
                    aria-pressed={c.id === classId}
                    onClick={() => setClassId(c.id)}
                  >
                    <span className="class-card-top">
                      <span className="class-card-name">{c.name}</span>
                    </span>
                    <span className="class-card-meta">{live[c.id]?.students ?? c.students} students · {c.language}</span>
                    {counts && (counts.red > 0 || counts.yellow > 0) && (
                      <span className="class-card-chips">
                        {counts.red > 0 && <span className="mini-chip is-red">{counts.red} needs you</span>}
                        {counts.yellow > 0 && <span className="mini-chip is-yellow">{counts.yellow} getting hints</span>}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          <button type="button" className="new-class" onClick={() => setNote('Adding classes is coming soon.')}>
            + New class
          </button>
          {note && <p className="th-note" role="status">{note}</p>}

          {/* A quiet night-sea picture to fill the corner */}
          <div className="night-scene" aria-hidden="true">
            <img src="/pixel/moon.svg" alt="" width="40" height="40" className="night-moon pixel-art" />
            <span className="map-wave" style={{ top: '38%' }} />
            <span className="map-wave" style={{ top: '70%' }} />
            <img src="/pixel/ship-green.svg" alt="" width="40" height="40" className="night-ship pixel-art" />
          </div>
        </aside>

        {/* The chosen class's banner */}
        <section className="class-banner" aria-labelledby="banner-title">
          <div>
            <h2 id="banner-title" className="banner-title">{current.name}</h2>
            <p className="banner-meta">{studentCount} students · {current.language}</p>
          </div>
          <img src="/pixel/moon.svg" alt="" width="48" height="48" className="banner-moon pixel-art" />
          <div className="banner-actions">
            <div className="class-code">
              <span className="class-code-label">Class code</span>
              <span className="class-code-value">{current.code}</span>
            </div>
            <Link to={`/teacher/${encodeURIComponent(current.id)}`} className="stone-button is-gold">Open Sea Map</Link>
          </div>
        </section>

        {/* Today's voyage: assigned quests, in order */}
        <section className="th-voyage" aria-labelledby="voyage-title">
          <div className="section-heading">
            <h2 id="voyage-title" className="section-title">Today&apos;s voyage</h2>
            <span className="section-note">Students sail these in order</span>
          </div>
          {voyage.length === 0 ? (
            <p className="queue-empty">No quests yet. Assign one from the library.</p>
          ) : (
            <ol className="voyage-list">
              {voyage.map((id, i) => {
                const q = questById[id]
                return (
                  <li key={id} className="voyage-item">
                    <span className="voyage-number">{i + 1}</span>
                    <span className="voyage-text">
                      <span className="voyage-title">{q.title}</span>
                      <span className="voyage-skill">{q.skill.toLowerCase()}</span>
                    </span>
                    <button
                      type="button"
                      className="small-button"
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                      aria-label={`Move ${q.title} up`}
                    >
                      ↑
                    </button>
                    <button type="button" className="small-button" onClick={() => remove(id)}>Remove</button>
                  </li>
                )
              })}
            </ol>
          )}
          <p className="voyage-footer">
            <img src="/pixel/star.svg" alt="" width="18" height="18" className="pixel-art" />
            {voyage.length} {voyage.length === 1 ? 'island' : 'islands'}, then the class reaches Ithaca
          </p>
        </section>

        {/* The quest library, grouped by skill */}
        <section className="th-library" aria-labelledby="library-title">
          <div className="section-heading">
            <h2 id="library-title" className="section-title">Quest library</h2>
          </div>

          <div className="skill-filters" role="tablist" aria-label="Filter by skill">
            {['All', ...SKILLS].map((s) => {
              const count = s === 'All' ? QUEST_LIBRARY.length : QUEST_LIBRARY.filter((q) => q.skill === s).length
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={skill === s}
                  className={`skill-filter${skill === s ? ' is-active' : ''}`}
                  onClick={() => setSkill(s)}
                >
                  {s} <span className="skill-count">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="library-list">
            {shownSkills.map((s) => {
              const quests = QUEST_LIBRARY.filter((q) => q.skill === s)
              return (
                <div key={s} className="library-group">
                  <h3 className="library-group-title">
                    {s}
                  </h3>
                  {quests.map((q) => {
                    const assigned = voyage.includes(q.id)
                    return (
                      <div key={q.id} className="library-item">
                        <span className="voyage-text">
                          <span className="voyage-title">{q.title}</span>
                          <span className="library-blurb">{q.blurb}</span>
                        </span>
                        {assigned ? (
                          <span className="assigned-chip">✓ Assigned</span>
                        ) : (
                          <button type="button" className="assign-button" onClick={() => assign(q.id)}>+ Assign</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </section>
      </main>

    </div>
  )
}
