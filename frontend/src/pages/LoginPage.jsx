import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// A simple start page: the kid types the sailor code their teacher gave them (like s1).
// There is no list of students here, so kids never see each other's names.
export default function LoginPage() {
  const [code, setCode] = useState('')
  const navigate = useNavigate()

  function handleSubmit(event) {
    event.preventDefault()
    const clean = code.trim()
    if (clean) navigate(`/student/${encodeURIComponent(clean)}`)
  }

  return (
    <div className="student-page">
      <main className="login-main">
        <form className="login-card" onSubmit={handleSubmit}>
          <img src="/pixel/athena-owl.svg" alt="" width="72" height="72" className="pixel-art" />
          <h1 className="greeting-title">Welcome aboard!</h1>
          <label htmlFor="sailor-code" className="quest-description">Type your sailor code</label>
          <input
            id="sailor-code"
            className="login-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoFocus
            placeholder="s1"
          />
          <button type="submit" className="stone-button is-gold">Set sail!</button>
        </form>
      </main>
      <div className="shore-border" aria-hidden="true" />
    </div>
  )
}
