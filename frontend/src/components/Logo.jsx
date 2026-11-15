// The MentorThena logo: the pixel mark (Athena's face as the sail of a little boat)
// and the wordmark, "Mentor" in navy and "Thena" in wood brown (gold on dark backgrounds).
export default function Logo() {
  return (
    <p className="logo">
      <img src="/pixel/logo-mark.svg" alt="" width="66" height="54" className="logo-mark pixel-art" />
      <span className="logo-word">
        Mentor<span className="logo-accent">Thena</span>
      </span>
    </p>
  )
}
