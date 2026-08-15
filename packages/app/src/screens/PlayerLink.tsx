import type { Player } from '@fm/domain'
import { useGame } from '../store.ts'

/**
 * A player's name, wherever it stands on its own, as a way into his ficha.
 *
 * The ficha is the richest screen in the game and for a long time only two
 * places could reach it — a Plantilla row and a Mercat listing. Every other
 * name was inert text, so being offered €525k for a man meant walking to
 * another screen and finding him again to see what you were selling.
 *
 * Closing the card returns you where you pressed: `inspect` records the screen
 * it was opened from, so a name in the market rail comes back to the market
 * rail rather than dumping you on the hub.
 *
 * `className` is for the caller's *layout*, never its appearance — a lineup row
 * needs its name cell to ellipsis inside a `minmax(0, 1fr)` column, which is a
 * property of the row and not of the link. Same split `.lineup-row__select`
 * already makes against the shared `.select`.
 */
export function PlayerLink({ player, className }: { player: Player; className?: string }) {
  const inspect = useGame((s) => s.inspect)

  return (
    <button
      type="button"
      className={className === undefined ? 'player-link' : `player-link ${className}`}
      onClick={() => {
        inspect(player.id)
      }}
    >
      {player.name}
    </button>
  )
}
