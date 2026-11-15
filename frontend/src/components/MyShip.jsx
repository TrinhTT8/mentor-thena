// The kid's own ship in the top bar: a bobbing pixel ship plus an icon and word,
// so the status is never shown by color alone.
// A kid never sees a red ship or the word "stuck": at red they see the hint ship
// and "Help is coming" (the teacher sees red on the Sea Map).
const KID_SHIPS = {
  green: { img: 'ship-green', icon: '✓', word: 'Sailing', tone: 'is-green' },
  yellow: { img: 'ship-yellow', icon: '?', word: 'Athena is helping', tone: 'is-yellow' },
  red: { img: 'ship-yellow', icon: '?', word: 'Help is coming', tone: 'is-yellow' },
  ithaca: { img: 'ship-ithaca', icon: '★', word: 'At Ithaca!', tone: 'is-ithaca' },
}

export default function MyShip({ status }) {
  const ship = KID_SHIPS[status] ?? KID_SHIPS.green
  return (
    <div className="my-ship">
      <img
        src={`/pixel/${ship.img}.svg`}
        alt=""
        width="64"
        height="64"
        className="my-ship-img pixel-art"
      />
      <span className={`status-chip ${ship.tone}`}>
        <span aria-hidden="true">{ship.icon}</span> {ship.word}
      </span>
    </div>
  )
}
