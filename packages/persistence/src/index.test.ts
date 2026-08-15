import { describe, expect, it } from 'vitest'
import {
  type Club,
  type ClubId,
  computeTable,
  createRng,
  EMPTY_LEDGER,
  FINANCE,
  type GameState,
  newSeason,
  reduce,
  type RngState,
  simulateSeason,
} from '@fm/domain'
import { PLAYER_NAMES } from '@fm/data'
import { SCHEMA_VERSION, type SaveEnvelope, wrapSave } from './index.ts'

const clubs: Club[] = Array.from({ length: 20 }, (_, i) => ({
  id: `c${String(i + 1).padStart(2, '0')}` as ClubId,
  name: `Club ${i + 1}`,
  shortName: `C${String(i + 1).padStart(2, '0')}`,
  attack: 70 + ((i * 7) % 21),
  defence: 70 + ((i * 11) % 21),
  budget: 400 + i * 50,
  capacity: 20_000 + i * 500,
  ticketPrice: FINANCE.TICKET,
  expansion: null,
  ledger: EMPTY_LEDGER,
  lastLedger: EMPTY_LEDGER,
}))

const tableOf = (state: GameState) => computeTable(state.competition.clubIds, state.season.fixtures)

describe('@fm/persistence', () => {
  it('stamps every save with a schema version', () => {
    expect(wrapSave({ clubs: [] }, createRng(1).state()).schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('carries RNG state through a JSON round-trip so a reload resumes the stream', () => {
    const rng = createRng(2026)
    for (let i = 0; i < 100; i++) rng.next()

    const saved = JSON.parse(JSON.stringify(wrapSave({ day: 42 }, rng.state()))) as SaveEnvelope<{
      day: number
    }>

    expect(createRng(saved.rngState).next()).toBe(rng.next())
  })
})

describe('mid-season save and restore', () => {
  it('finishes a saved season exactly as an uninterrupted run would', () => {
    // The reason ADR 0002 chose sfc32, exercised at the level that actually
    // matters. A career saved in February must produce the same March, May and
    // final table as one that was never interrupted.
    const SEED = 4242
    const HALF_SEASON_DAYS = 140

    // Uninterrupted control run.
    const control = simulateSeason(
      newSeason(clubs, 2026, { names: PLAYER_NAMES, rng: createRng(11) }),
      createRng(SEED),
    )

    // Interrupted run: play half a season, then save.
    const rng = createRng(SEED)
    let state = newSeason(clubs, 2026, { names: PLAYER_NAMES, rng: createRng(11) })
    for (let day = 0; day < HALF_SEASON_DAYS; day++) {
      state = reduce(state, { type: 'AdvanceDay' }, rng).state
    }

    const played = state.season.fixtures.filter((f) => f.result !== null).length
    expect(played).toBeGreaterThan(0)
    expect(played).toBeLessThan(380) // genuinely mid-season, not a trivial case

    const envelope = wrapSave(state, rng.state())
    const reloaded = JSON.parse(JSON.stringify(envelope)) as SaveEnvelope<GameState>

    // Resume from the save alone — nothing carried over in memory.
    const resumed = simulateSeason(reloaded.payload, createRng(reloaded.rngState))

    expect(tableOf(resumed)).toEqual(tableOf(control))
    expect(resumed.season.fixtures).toEqual(control.season.fixtures)
  })

  it('diverges if the RNG state is discarded — proving the assertion above has teeth', () => {
    // A save that omits rngState looks fine and silently breaks determinism. This
    // asserts the previous test would actually catch that.
    const SEED = 4242
    const control = simulateSeason(
      newSeason(clubs, 2026, { names: PLAYER_NAMES, rng: createRng(11) }),
      createRng(SEED),
    )

    const rng = createRng(SEED)
    let state = newSeason(clubs, 2026, { names: PLAYER_NAMES, rng: createRng(11) })
    for (let day = 0; day < 140; day++) {
      state = reduce(state, { type: 'AdvanceDay' }, rng).state
    }

    // Re-seeding from scratch instead of restoring the captured state.
    const wrong = simulateSeason(state, createRng(SEED))
    expect(tableOf(wrong)).not.toEqual(tableOf(control))
  })

  it('round-trips branded types through JSON unchanged', () => {
    const state = newSeason(clubs, 2026, { names: PLAYER_NAMES, rng: createRng(11) })
    const envelope: SaveEnvelope<GameState> = wrapSave(state, createRng(1).state())
    const revived = JSON.parse(JSON.stringify(envelope)) as SaveEnvelope<GameState>

    expect(revived.payload).toEqual(state)
    expect(revived.payload.season.currentDate).toBe(state.season.currentDate)
    expect(revived.rngState).toEqual(envelope.rngState satisfies RngState)
  })
})
