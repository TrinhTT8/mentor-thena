import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// The log in page: a night sea with the logo on the left and the log in card on the right.
// Kids log in with their class code, first name and a SECRET PICTURE (no typed password,
// and no list of names, so kids never see each other). Teachers use the captain tab.
//
// DEMO: the server has no accounts yet, so nothing is checked against real data.
// A student who fills in all three goes to the demo student; a teacher goes to the
// teacher home. Replace sailorLogin / captainLogin when Person A adds a login route.
const DEMO_STUDENT_ID = 's1'

const PICTURES = [
  { id: 'owl', label: 'Owl', src: '/pixel/athena-owl.svg' },
  { id: 'star', label: 'Star', src: '/pixel/star.svg' },
  { id: 'anchor', label: 'Anchor', src: '/pixel/pic-anchor.svg' },
  { id: 'shield', label: 'Shield', src: '/pixel/pic-shield.svg' },
  { id: 'waves', label: 'Waves', src: '/pixel/pic-waves.svg' },
  { id: 'olive', label: 'Olive branch', src: '/pixel/pic-olive.svg' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState('sailor') // 'sailor' (student) or 'captain' (teacher)
  const [classCode, setClassCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [picture, setPicture] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    if (role === 'sailor') {
      if (!classCode.trim() || !firstName.trim() || !picture) {
        setMessage('Fill in your class code and first name, and tap your secret picture.')
        return
      }
      navigate(`/student/${DEMO_STUDENT_ID}`) // DEMO: every sailor opens the demo student
    } else {
      if (!email.trim() || !password) {
        setMessage('Fill in your email and password.')
        return
      }
      navigate('/teacher') // DEMO: no password check yet
    }
  }

  function pickRole(next) {
    setRole(next)
    setMessage('')
  }

  return (
    <div className="login-page">
      {/* The night sky */}
      <div className="login-sky" aria-hidden="true">
        <img src="/pixel/moon.svg" alt="" width="64" height="64" className="login-moon pixel-art" />
        <img src="/pixel/cloud.svg" alt="" width="80" height="24" className="login-cloud pixel-art" />
        <img src="/pixel/sparkle.svg" alt="" width="16" height="16" className="login-twinkle pixel-art" style={{ top: '14%', left: '38%' }} />
        <img src="/pixel/sparkle.svg" alt="" width="16" height="16" className="login-twinkle pixel-art" style={{ top: '8%', left: '86%', animationDelay: '0.6s' }} />
        <img src="/pixel/sparkle.svg" alt="" width="12" height="12" className="login-twinkle pixel-art" style={{ top: '22%', left: '12%', animationDelay: '1.1s' }} />
      </div>

      <main className="login-main">
        {/* Left: the logo and the tagline */}
        <section className="login-brand">
          <img src="/pixel/logo-mark.svg" alt="" width="132" height="108" className="login-mark pixel-art" />
          <h1 className="login-word">Mentor<span>Thena</span></h1>
          <p className="login-tagline">Every coder is a hero. Athena shows the way home.</p>
        </section>

        {/* Right: the log in card, with Athena peeking over it (she sits just outside
            the card, so its stepped corners don't cut her off) */}
        <div className="peek-wrap">
        <img src="/pixel/athena-owl.svg" alt="" width="56" height="56" className="peek-owl pixel-art" />
        <form className="login-card" onSubmit={handleSubmit} noValidate>

          <div className="role-tabs" role="tablist" aria-label="Who is logging in">
            <button
              type="button"
              role="tab"
              aria-selected={role === 'sailor'}
              className={`role-tab${role === 'sailor' ? ' is-active' : ''}`}
              onClick={() => pickRole('sailor')}
            >
              <span className="role-tab-title">I&apos;m a sailor</span>
              <span className="role-tab-sub">Student</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === 'captain'}
              className={`role-tab${role === 'captain' ? ' is-active' : ''}`}
              onClick={() => pickRole('captain')}
            >
              <span className="role-tab-title">I&apos;m the captain</span>
              <span className="role-tab-sub">Teacher</span>
            </button>
          </div>

          {role === 'sailor' ? (
            <>
              <label className="login-label" htmlFor="class-code">Class code</label>
              <input
                id="class-code"
                className="login-input"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="ODY-42"
                autoComplete="off"
                spellCheck="false"
              />

              <label className="login-label" htmlFor="first-name">Your first name</label>
              <input
                id="first-name"
                className="login-input is-reading"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Alex"
                autoComplete="given-name"
              />

              <span className="login-label" id="picture-label">Tap your secret picture</span>
              <div className="picture-grid" role="radiogroup" aria-labelledby="picture-label">
                {PICTURES.map((pic) => (
                  <button
                    key={pic.id}
                    type="button"
                    role="radio"
                    aria-checked={picture === pic.id}
                    aria-label={pic.label}
                    className={`picture-choice${picture === pic.id ? ' is-picked' : ''}`}
                    onClick={() => setPicture(pic.id)}
                  >
                    <img src={pic.src} alt="" width="28" height="28" className="pixel-art" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <label className="login-label" htmlFor="teacher-email">School email</label>
              <input
                id="teacher-email"
                type="email"
                className="login-input is-reading"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.org"
                autoComplete="email"
              />
              <label className="login-label" htmlFor="teacher-password">Password</label>
              <input
                id="teacher-password"
                type="password"
                className="login-input is-reading"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </>
          )}

          <p className="login-message" role="alert">{message}</p>

          <button type="submit" className="stone-button is-gold login-submit">Set sail!</button>
          <p className="login-help">
            {role === 'sailor' ? 'Forgot your picture? Ask your teacher.' : 'New captain? Ask your school to add you.'}
          </p>
        </form>
        </div>
      </main>

      {/* The sea along the bottom: drifting foam, Ithaca's lighthouse, and Odysseus sailing */}
      <div className="login-sea" aria-hidden="true">
        <span className="map-wave" style={{ top: '6%' }} />
        <span className="map-wave" style={{ top: '46%' }} />
        <span className="map-wave" style={{ top: '84%' }} />
        <div className="login-ithaca">
          <span className="lighthouse-beam" />
          <img src="/pixel/lighthouse.svg" alt="" width="32" height="88" className="login-lighthouse pixel-art" />
          <img src="/pixel/island-ithaca.svg" alt="" width="120" height="78" className="pixel-art" />
        </div>
        <img src="/pixel/odysseus-boat.svg" alt="" width="130" height="110" className="login-hero pixel-art" />
      </div>
    </div>
  )
}
