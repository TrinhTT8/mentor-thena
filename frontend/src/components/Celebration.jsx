import { useEffect, useRef } from 'react'

// Shown once when the kid reaches Ithaca: a gold-framed window with a big gold ship
// and twinkling sparkles. Uses the browser's <dialog>, so Esc and the button close it
// and keyboard focus stays inside while it is open.
const SPARKLES = [
  { top: '8%', left: '12%' },
  { top: '18%', left: '82%' },
  { top: '52%', left: '6%' },
  { top: '60%', left: '88%' },
  { top: '4%', left: '50%' },
]

export default function Celebration({ open, onClose }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={dialogRef} className="celebration" aria-labelledby="celebration-title" onClose={onClose}>
      <div className="celebration-art">
        {SPARKLES.map((spot, i) => (
          <img
            key={i}
            src="/pixel/sparkle.svg"
            alt=""
            width="20"
            height="20"
            className="sparkle pixel-art"
            style={{ ...spot, animationDelay: `${i * 0.3}s` }}
          />
        ))}
        <img src="/pixel/ship-ithaca.svg" alt="" width="160" height="160" className="celebration-ship pixel-art" />
      </div>
      <h2 id="celebration-title" className="celebration-title">You reached Ithaca!</h2>
      <p className="celebration-text">Great sailing! Your code does exactly what the quest asked.</p>
      <button type="button" className="stone-button is-gold" onClick={onClose} autoFocus>
        Hooray!
      </button>
    </dialog>
  )
}
