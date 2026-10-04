import { PlayerLink as PlayerLinkView } from '@fm/design-system'
import type { Player } from '@fm/domain'
import { useGame } from '../store.ts'

/** A player's name that opens his ficha: the design system's link, wired to the store. */
export function PlayerLink({ player, className }: { player: Player; className?: string }) {
  const inspect = useGame((s) => s.inspect)

  return (
    <PlayerLinkView
      label={player.name}
      onClick={() => {
        inspect(player.id)
      }}
      {...(className === undefined ? {} : { className })}
    />
  )
}
