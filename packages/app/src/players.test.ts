import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_CLUBS } from '@fm/data'
import { playersById } from './players.ts'
import { useGame } from './store.ts'

const MANAGED = DEFAULT_CLUBS[0]?.id
if (MANAGED === undefined) throw new Error('no clubs')

beforeEach(() => {
  useGame.getState().newGame(MANAGED)
})

const game = () => useGame.getState().game

describe('playersById', () => {
  it('holds everybody the game has, including the squads abroad', () => {
    // **The line this function exists for.** Two screens built this map inline
    // and only one remembered the foreign layer; the market screen's copy did
    // not, which cost a completable cross-border transfer.
    const players = playersById(game())

    for (const club of game().foreign.clubs) {
      for (const player of game().foreign.squads[club.id] ?? []) {
        expect(players.get(player.id)?.name).toBe(player.name)
      }
    }

    // A guard on the guard: a foreign league with nobody in it would satisfy the
    // loop above without asserting anything.
    expect(game().foreign.clubs.length).toBeGreaterThan(0)
  })

  it('holds the division and the free-agent pool too', () => {
    const players = playersById(game())

    for (const club of game().clubs) {
      for (const player of game().squads[club.id] ?? []) {
        expect(players.has(player.id)).toBe(true)
      }
    }
    for (const player of game().freeAgents) expect(players.has(player.id)).toBe(true)
  })

  it('counts every player exactly once', () => {
    // Ids are unique across the whole game, so the map's size is the population.
    // A collision would silently hide a player behind another's card.
    const state = game()
    const total =
      state.clubs.reduce((n, c) => n + (state.squads[c.id] ?? []).length, 0) +
      state.foreign.clubs.reduce((n, c) => n + (state.foreign.squads[c.id] ?? []).length, 0) +
      state.freeAgents.length

    expect(playersById(state).size).toBe(total)
  })
})
