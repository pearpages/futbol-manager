import type { GameState, Player, PlayerId } from '@fm/domain'

/**
 * Every player in the game by id — the division, abroad, and the free-agent pool.
 *
 * **Shared because forgetting the foreign layer cost a completable transfer.**
 * Two screens built this map inline and only one remembered `game.foreign`. The
 * market screen's copy did not, which read as two unrelated defects: a bid row
 * naming a man "unknown", and — because the negotiation panel resolves a live bid
 * through this same map when the player has left the listings — pressing *Open*
 * doing nothing at all. A player abroad is only ever in `listingsFor` if he is one
 * of his club's `FOREIGN_LISTINGS` fringe, so for everyone signed through the Clubs
 * tab that fallback is the *only* route to personal terms. One function, so the
 * next lookup cannot miss a squad the game has.
 *
 * Not `findPlayer` from `domain`, which is private to the reducer and answers a
 * different question: it hands back the holder alongside the player, which is what
 * a bid needs and a name does not. `PlayerScreen` asks that version of the question
 * itself, and deliberately keeps its own search.
 */
export function playersById(game: GameState): Map<PlayerId, Player> {
  const players = new Map<PlayerId, Player>()

  for (const club of game.clubs) {
    for (const player of game.squads[club.id] ?? []) players.set(player.id, player)
  }
  for (const club of game.foreign.clubs) {
    for (const player of game.foreign.squads[club.id] ?? []) players.set(player.id, player)
  }
  // `null` for an owner, and still very much in the game.
  for (const player of game.freeAgents) players.set(player.id, player)

  return players
}
