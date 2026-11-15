// The kid's own ship, top right: a framed chip with a bobbing pixel ship and a word
// (the ship picture and the word show the status, so it is never color alone).
// A kid never sees a red ship or the word "stuck": at red they see "Help is coming"
// (the teacher sees red on the Sea Map).
const KID_SHIPS = {
  green: { img: 'ship-green', word: 'Sailing' },
  yellow: { img: 'ship-helping', word: 'Athena is helping' },
  red: { img: 'ship-helping', word: 'Help is coming' },
  ithaca: { img: 'ship-home', word: 'At Ithaca!' },
}

export default function MyShip({ status }) {
  const ship = KID_SHIPS[status] ?? KID_SHIPS.green
  return (
    <div className="my-ship" role="status">
      <img src={`/pixel/${ship.img}.svg`} alt="" width="40" height="40" className="my-ship-img pixel-art" />
      <span className="my-ship-word">{ship.word}</span>
    </div>
  )
}
