import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// The teacher's button in the top right: initials, name and a menu with Log out.
// The server does not send the teacher's name yet, so it says "Teacher".
export default function TeacherMenu({ name = 'Teacher' }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const initials = name.split(/\s+/).map((w) => w.replace(/[^A-Za-z]/g, '')[0] ?? '').join('').slice(0, 2).toUpperCase()

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

  return (
    <div className="profile" ref={menuRef}>
      <button
        type="button"
        className="profile-button teacher-profile"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="initials-avatar" aria-hidden="true">{initials}</span>
        <span className="teacher-name">{name}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="profile-card">
          <span className="initials-avatar is-big" aria-hidden="true">{initials}</span>
          <p className="profile-card-name">{name}</p>
          <button type="button" className="stone-button is-small" onClick={() => navigate('/')}>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
