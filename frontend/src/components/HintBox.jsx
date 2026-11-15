// Shows Athena's latest hint, or "Athena is thinking..." while the server makes one.
// The hint object only has level, text and from_ships_log (reason/concept are teacher-only).
export default function HintBox({ hint, thinking }) {
  if (thinking) {
    return <div className="hint-box hint-thinking">Athena is thinking...</div>
  }
  if (!hint) return null

  return (
    <div className="hint-box">
      <span className="hint-lead">Athena says:</span>
      <p className="hint-text">{hint.text}</p>
    </div>
  )
}
