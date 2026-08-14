import { describe, expect, it } from 'vitest'
import { createRng } from '@fm/domain'
import { MIGRATIONS, migratePayload, needsSquads, SCHEMA_VERSION } from './migrations.ts'
import { readSave, type SaveEnvelope, wrapSave } from './index.ts'
import v1Fixture from './fixtures/v1.json' with { type: 'json' }
import v3Fixture from './fixtures/v3.json' with { type: 'json' }
import v4Fixture from './fixtures/v4.json' with { type: 'json' }
import v5Fixture from './fixtures/v5.json' with { type: 'json' }
import v6Fixture from './fixtures/v6.json' with { type: 'json' }

describe('the migration chain', () => {
  it('is contiguous and forward-only', () => {
    // A gap would leave a version unloadable; a backward step would loop.
    let expected = 1
    for (const migration of MIGRATIONS) {
      expect(migration.from).toBe(expected)
      expect(migration.to).toBe(migration.from + 1)
      expected = migration.to
    }
    expect(SCHEMA_VERSION).toBe(expected)
  })

  it('describes every step', () => {
    // The description is what a future reader has instead of the original context.
    for (const migration of MIGRATIONS) {
      expect(migration.describe.length).toBeGreaterThan(10)
    }
  })

  it('is a no-op for a save already at the current version', () => {
    const payload = { squads: { a: [] }, lineups: {}, tactics: {} }
    expect(migratePayload(payload, SCHEMA_VERSION)).toEqual(payload)
  })

  it('refuses a save from the future rather than guessing', () => {
    // Loading a newer build's save by ignoring what we don't understand would
    // quietly corrupt a career.
    expect(() => migratePayload({}, SCHEMA_VERSION + 1)).toThrow(/only understands up to/)
  })

  it('rejects a nonsense version', () => {
    expect(() => migratePayload({}, 0)).toThrow(/Invalid save version/)
  })
})

describe('the v1 fixture save', () => {
  // The discipline the roadmap's cross-cutting track requires: one committed save
  // per shipped version, and a round-trip test against it. Without a real stored
  // file, a migration is only ever tested against data written by the same build
  // that wrote the migration.

  const envelope = v1Fixture as unknown as SaveEnvelope<unknown>

  it('is genuinely a v1 save', () => {
    expect(envelope.schemaVersion).toBe(1)
    expect(envelope.rngState).toHaveLength(4)
    expect(envelope.payload).not.toHaveProperty('squads')
  })

  it('migrates up to the current version', () => {
    const loaded = readSave(envelope)
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION)
    expect(loaded.payload).toHaveProperty('squads')
    expect(loaded.payload).toHaveProperty('lineups')
  })

  it('preserves everything v1 already knew', () => {
    const before = envelope.payload as {
      clubs: { id: string; name: string; attack: number }[]
      season: { startYear: number }
    }
    const after = readSave(envelope).payload as typeof before

    // Later migrations *add* fields — budgets at v4 — so the check is that the
    // original ones survive, not that the objects are untouched.
    expect(after.clubs.map((c) => c.id)).toEqual(before.clubs.map((c) => c.id))
    expect(after.clubs.map((c) => c.name)).toEqual(before.clubs.map((c) => c.name))
    expect(after.clubs.map((c) => c.attack)).toEqual(before.clubs.map((c) => c.attack))
    expect(after.season.startYear).toBe(before.season.startYear)
  })

  it('gives every club a budget and every player a contract', () => {
    const after = readSave(envelope).payload as {
      clubs: { budget: number }[]
      squads: Record<string, { contract: { until: number } }[]>
    }
    expect(after.clubs.every((c) => c.budget > 0)).toBe(true)
    // v1 predates squads entirely, so there is nothing to contract yet — the
    // loader generates them. This asserts the shape survives an empty map.
    expect(after.squads).toEqual({})
  })

  it('carries the rng state through untouched', () => {
    expect(readSave(envelope).rngState).toEqual(envelope.rngState)
  })

  it('reports that it still needs squads generating', () => {
    // v1 predates players, and `persistence` must not depend on generation — so
    // the loader is told rather than guessing.
    expect(needsSquads(readSave(envelope).payload)).toBe(true)
  })
})

describe('the v3 fixture save', () => {
  // v3 is the version M3c shipped: squads and lineups, but no contracts and no
  // money. It exists so the v3→v4 migration is tested against data an earlier
  // build actually wrote, not data the migration's own build invented.
  const envelope = v3Fixture as unknown as SaveEnvelope<unknown>

  it('is genuinely a v3 save — no contracts, no budgets', () => {
    expect(envelope.schemaVersion).toBe(3)
    const payload = envelope.payload as {
      clubs: Record<string, unknown>[]
      squads: Record<string, Record<string, unknown>[]>
    }
    expect(payload.clubs.every((c) => !('budget' in c))).toBe(true)
    expect(
      Object.values(payload.squads)
        .flat()
        .every((p) => !('contract' in p)),
    ).toBe(true)
  })

  it('gains a budget for every club and a contract for every player', () => {
    const after = readSave(envelope).payload as {
      clubs: { budget: number }[]
      squads: Record<string, { contract: { until: number; wage: number } }[]>
    }

    expect(after.clubs.every((c) => c.budget > 0)).toBe(true)
    const players = Object.values(after.squads).flat()
    expect(players).toHaveLength(460)
    expect(players.every((p) => typeof p.contract.until === 'number')).toBe(true)
  })

  it('staggers contract expiries rather than expiring a whole league at once', () => {
    // All 460 falling due in the same summer would make one window do every deal.
    const after = readSave(envelope).payload as {
      squads: Record<string, { contract: { until: number } }[]>
    }
    const expiries = new Set(
      Object.values(after.squads)
        .flat()
        .map((p) => p.contract.until),
    )
    expect(expiries.size).toBeGreaterThan(1)
  })

  it('is deterministic — migrating twice gives the same result', () => {
    // A migration that used an rng would produce a different league each load.
    expect(readSave(envelope).payload).toEqual(readSave(envelope).payload)
  })

  it('preserves the season it was saved in', () => {
    const before = envelope.payload as { season: { startYear: number; currentDate: number } }
    const after = readSave(envelope).payload as typeof before
    expect(after.season.startYear).toBe(before.season.startYear)
    expect(after.season.currentDate).toBe(before.season.currentDate)
  })
})

describe('the v4 fixture save', () => {
  // v4 is what M4a shipped: contracts and budgets, a market the AI ran on its own,
  // and no way for a person to touch it. Written by `pnpm fixture` against that
  // build, mid-season, so the day clock and the rng cursor are both off their
  // starting values.
  const envelope = v4Fixture as unknown as SaveEnvelope<unknown>

  it('is genuinely a v4 save — a market with no human in it', () => {
    expect(envelope.schemaVersion).toBe(4)
    const payload = envelope.payload as Record<string, unknown>
    expect(payload).not.toHaveProperty('bids')
    expect(payload).not.toHaveProperty('freeAgents')
    expect(payload).not.toHaveProperty('shortlist')
    // But it does already have what v4 added, or it is not really a v4 save.
    const clubs = payload['clubs'] as { budget?: number }[]
    expect(clubs.every((c) => typeof c.budget === 'number')).toBe(true)
  })

  it('gains an empty market for the human to start from', () => {
    const after = readSave(envelope).payload as {
      bids: unknown[]
      freeAgents: unknown[]
      shortlist: unknown[]
    }
    expect(after.bids).toEqual([])
    expect(after.freeAgents).toEqual([])
    expect(after.shortlist).toEqual([])
  })

  it('preserves the career it was saved in', () => {
    const before = envelope.payload as {
      season: { startYear: number; currentDate: number; fixtures: { result: unknown }[] }
      managedClubId: string
      squads: Record<string, unknown[]>
    }
    const after = readSave(envelope).payload as typeof before

    expect(after.season.startYear).toBe(before.season.startYear)
    expect(after.season.currentDate).toBe(before.season.currentDate)
    expect(after.managedClubId).toBe(before.managedClubId)
    // Results already played must survive, or reloading rewrites the season.
    const playedBefore = before.season.fixtures.filter((f) => f.result !== null).length
    expect(after.season.fixtures.filter((f) => f.result !== null)).toHaveLength(playedBefore)
    expect(Object.values(after.squads).flat()).toHaveLength(460)
  })

  it('carries the rng state through untouched', () => {
    expect(readSave(envelope).rngState).toEqual(envelope.rngState)
  })

  it('is deterministic — migrating twice gives the same result', () => {
    expect(readSave(envelope).payload).toEqual(readSave(envelope).payload)
  })
})

describe('the v5 fixture save', () => {
  // v5 is what M4b shipped: a market the manager could buy in but not sell in.
  // Written by `pnpm fixture` against that build, before `v5ToV6` existed — which
  // is the only moment it could have been captured.
  const envelope = v5Fixture as unknown as SaveEnvelope<unknown>

  it('is genuinely a v5 save — a market you can only buy in', () => {
    expect(envelope.schemaVersion).toBe(5)
    const payload = envelope.payload as Record<string, unknown>
    // M4b's fields are there…
    expect(payload).toHaveProperty('bids')
    expect(payload).toHaveProperty('freeAgents')
    expect(payload).toHaveProperty('shortlist')
    // …and the sell side is not.
    expect(payload).not.toHaveProperty('transferList')
  })

  it('gains an empty transfer list', () => {
    const after = readSave(envelope).payload as { transferList: unknown[] }
    expect(after.transferList).toEqual([])
  })

  it('preserves the career it was saved in', () => {
    const before = envelope.payload as {
      season: { startYear: number; currentDate: number; fixtures: { result: unknown }[] }
      managedClubId: string
      squads: Record<string, unknown[]>
      clubs: { budget: number }[]
    }
    const after = readSave(envelope).payload as typeof before

    expect(after.season.startYear).toBe(before.season.startYear)
    expect(after.season.currentDate).toBe(before.season.currentDate)
    expect(after.managedClubId).toBe(before.managedClubId)
    expect(after.clubs.map((c) => c.budget)).toEqual(before.clubs.map((c) => c.budget))
    const playedBefore = before.season.fixtures.filter((f) => f.result !== null).length
    expect(after.season.fixtures.filter((f) => f.result !== null)).toHaveLength(playedBefore)
    expect(Object.values(after.squads).flat()).toHaveLength(460)
  })

  it('carries the rng state through untouched', () => {
    expect(readSave(envelope).rngState).toEqual(envelope.rngState)
  })

  it('is deterministic — migrating twice gives the same result', () => {
    expect(readSave(envelope).payload).toEqual(readSave(envelope).payload)
  })
})

describe('the v6 fixture save', () => {
  // v6 is what M4c shipped: a market you could both buy and sell in, and money
  // that only ever moved between clubs. Captured by `pnpm fixture` against that
  // build, before `v6ToV7` existed — the only moment it could have been.
  const envelope = v6Fixture as unknown as SaveEnvelope<unknown>

  it('is genuinely a v6 save — a closed economy', () => {
    expect(envelope.schemaVersion).toBe(6)
    const payload = envelope.payload as { transferList?: unknown; clubs: Record<string, unknown>[] }
    // M4c's field is there…
    expect(payload).toHaveProperty('transferList')
    // …and no club has a ground or a set of books.
    for (const club of payload.clubs) {
      expect(club).not.toHaveProperty('capacity')
      expect(club).not.toHaveProperty('ledger')
    }
  })

  it('gives every club a ground sized by its rating', () => {
    const after = readSave(envelope).payload as {
      clubs: { attack: number; defence: number; capacity: number }[]
    }
    for (const club of after.clubs) {
      expect(club.capacity).toBeGreaterThan(0)
    }
    // Bigger club, bigger ground — the property the curve exists for.
    const sorted = [...after.clubs].sort((a, b) => b.attack + b.defence - (a.attack + a.defence))
    expect(sorted[0]?.capacity).toBeGreaterThan(sorted.at(-1)?.capacity ?? 0)
  })

  it('opens the books empty rather than inventing a season', () => {
    // There is no honest way to reconstruct accounts after the fact, and empty is
    // true: this save has earned nothing under the new rules yet.
    const after = readSave(envelope).payload as {
      clubs: { ledger: Record<string, number>; lastLedger: Record<string, number> }[]
    }
    for (const club of after.clubs) {
      expect(Object.values(club.ledger).every((v) => v === 0)).toBe(true)
      expect(Object.values(club.lastLedger).every((v) => v === 0)).toBe(true)
    }
  })

  it('preserves the career it was saved in', () => {
    const before = envelope.payload as {
      season: { startYear: number; currentDate: number; fixtures: { result: unknown }[] }
      managedClubId: string
      squads: Record<string, unknown[]>
      clubs: { budget: number }[]
    }
    const after = readSave(envelope).payload as typeof before

    expect(after.season.startYear).toBe(before.season.startYear)
    expect(after.season.currentDate).toBe(before.season.currentDate)
    expect(after.managedClubId).toBe(before.managedClubId)
    // Balances survive untouched: the economy is new, the money in it is not.
    expect(after.clubs.map((c) => c.budget)).toEqual(before.clubs.map((c) => c.budget))
    const playedBefore = before.season.fixtures.filter((f) => f.result !== null).length
    expect(after.season.fixtures.filter((f) => f.result !== null)).toHaveLength(playedBefore)
    expect(Object.values(after.squads).flat()).toHaveLength(460)
  })

  it('carries the rng state through untouched', () => {
    expect(readSave(envelope).rngState).toEqual(envelope.rngState)
  })

  it('is deterministic — migrating twice gives the same result', () => {
    expect(readSave(envelope).payload).toEqual(readSave(envelope).payload)
  })
})

describe('needsSquads', () => {
  it('is false once squads are present', () => {
    expect(needsSquads({ squads: { a: [{}] } })).toBe(false)
  })

  it('is true for an empty or missing squads map', () => {
    expect(needsSquads({ squads: {} })).toBe(true)
    expect(needsSquads({})).toBe(true)
  })
})

describe('wrapSave', () => {
  it('stamps the current schema version', () => {
    expect(wrapSave({}, createRng(1).state()).schemaVersion).toBe(SCHEMA_VERSION)
  })
})
