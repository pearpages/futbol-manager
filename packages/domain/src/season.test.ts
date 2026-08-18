import { describe, expect, it } from 'vitest'
import { contractExpiry, type Player } from './player.ts'
import { createRng } from './rng.ts'
import { defaultSeasonStart, rolloverSeason } from './season.ts'
import { newSeason } from './simulate.ts'
import type { GameState } from './state.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'

/**
 * The rollover's two filters on the free-agent pool, and the order they run in.
 *
 * The statistical claims — that the population holds and the pool stays bounded —
 * belong to `market.harness.test.ts`, over a whole career. This is the mechanical
 * one underneath them.
 */

const START_YEAR = 2026
const rollover = (state: GameState, seed = 99) => {
  const rng = createRng(seed)
  const next = rolloverSeason(state, rng, { names: TEST_NAMES })
  return { next, rngState: rng.state() }
}

const fresh = () => newSeason(TEST_CLUBS, START_YEAR, { names: TEST_NAMES, rng: createRng(7) })

/** A pooled player whose deal lapsed `years` summers ago. */
const stale = (id: string, years: number): Player => {
  const template = Object.values(fresh().squads)[0]?.[0]
  /* c8 ignore next */
  if (template === undefined) throw new Error('no squads')
  return {
    ...template,
    id: `stale-${id}` as Player['id'],
    contract: { ...template.contract, until: contractExpiry(START_YEAR + 1 - years) },
  }
}

describe('the free-agent pool at a rollover', () => {
  it('drops players nobody has signed for several summers', () => {
    const state = { ...fresh(), freeAgents: [stale('recent', 0), stale('ancient', 5)] }
    const ids = rollover(state).next.freeAgents.map((p) => p.id)

    expect(ids).toContain('stale-recent')
    expect(ids).not.toContain('stale-ancient')
  })

  it('rolls for retirement before dropping them, not after', () => {
    // **Load-bearing, and invisible in the output.** The retirement roll draws one
    // `rng.next()` per pooled player. Filtering first would change how many draws
    // *this* rollover makes and shift the stream for a reason that has nothing to
    // do with the feature — every match result after it would move.
    //
    // So the claim is about consumption rather than about who survives: adding
    // players the patience rule is about to discard must still cost draws. Run the
    // filters the other way round and it costs none, and these two states end on
    // the same generator.
    const base = fresh()
    const withStale = {
      ...base,
      freeAgents: [stale('a', 6), stale('b', 6), stale('c', 6)],
    }

    // Not "the pool is empty" — a rollover *adds* to it, as this one's releases do.
    const survivors = rollover(withStale).next.freeAgents.map((p) => p.id)
    expect(survivors.filter((id) => id.startsWith('stale-'))).toHaveLength(0)
    expect(rollover(withStale).rngState).not.toEqual(rollover(base).rngState)
  })
})

describe('topping a thin squad back up', () => {
  it('signs nobody for a club that is already big enough', () => {
    const state = fresh()
    const club = TEST_CLUBS[0]?.id ?? ''
    const before = state.squads[club]?.length ?? 0
    expect(before).toBeGreaterThan(20)

    const after = rollover(state).next.squads[club]?.length ?? 0
    // Retirements are replaced one-for-one and releases stop at the target, so a
    // full squad comes through a quiet summer the same size.
    expect(after).toBeGreaterThanOrEqual(20)
  })

  it('fills a squad that has been sold down, at the position it is short of', () => {
    const state = fresh()
    const club = TEST_CLUBS[0]?.id ?? ''
    const squad = state.squads[club] ?? []
    // Sixteen players, and deliberately only one goalkeeper — a club that has sold
    // its way to the floor is the case `topUp` exists for.
    const thin = [
      ...squad.filter((p) => p.position === 'GK').slice(0, 1),
      ...squad.filter((p) => p.position !== 'GK').slice(0, 15),
    ]
    const before = { ...state, squads: { ...state.squads, [club]: thin } }

    const after = rollover(before).next.squads[club] ?? []
    expect(after.length).toBeGreaterThanOrEqual(20)
    expect(after.filter((p) => p.position === 'GK').length).toBeGreaterThan(1)
  })

  it('names the new arrivals from the pool, not from the shipped rosters', () => {
    // The drift ADR 0010 says a long career is supposed to have: the opening
    // squads are shaped on real ones, everybody who arrives afterwards is not.
    const state = fresh()
    const club = TEST_CLUBS[0]?.id ?? ''
    const squad = state.squads[club] ?? []
    const before = { ...state, squads: { ...state.squads, [club]: squad.slice(0, 16) } }

    const known = new Set(squad.map((p) => p.id))
    const arrivals = (rollover(before).next.squads[club] ?? []).filter((p) => !known.has(p.id))

    expect(arrivals.length).toBeGreaterThan(0)
    for (const player of arrivals) expect(TEST_NAMES).toContain(player.name)
  })
})

/** Unused, but it keeps `defaultSeasonStart` honest about the year it is handed. */
it('opens a season in mid-August', () => {
  expect(defaultSeasonStart(START_YEAR)).toBe(defaultSeasonStart(START_YEAR))
})
