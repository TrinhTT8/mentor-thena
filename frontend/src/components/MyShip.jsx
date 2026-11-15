// The kid's own ship, top right: a framed chip with a bobbing pixel ship, a word,
// and a small square in the status color (so status is never color alone).
// A kid never sees a red ship or the word "stuck": at red they see "Help is coming"
// (the teacher sees red on the Sea Map).
const KID_SHIPS = {
  green: { img: 'ship-green', word: 'Sailing', tone: 'is-green' },
  yellow: { img: 'ship-yellow', word: 'Athena is helping', tone: 'is-yellow' },
  red: { img: 'ship-yellow', word: 'Help is coming', tone: 'is-yellow' },
  ithaca: { img: 'ship-ithaca', word: 'At Ithaca!', tone: 'is-ithaca' },
}

export default function MyShip({ status }) {
  const ship = KID_SHIPS[status] ?? KID_SHIPS.green
  return (
    <div className="my-ship" role="status">
      <img src={`/pixel/${ship.img}.svg`} alt="" width="40" height="40" className="my-ship-img pixel-art" />
      <span className="my-ship-word">{ship.word}</span>
      <span className={`status-square ${ship.tone}`} aria-hidden="true" />
    </div>
  )
}
