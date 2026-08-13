import { describe, expect, it } from 'vitest'
import { createRng } from '@fm/domain'
import { MIGRATIONS, migratePayload, needsSquads, SCHEMA_VERSION } from './migrations.ts'
import { readSave, type SaveEnvelope, wrapSave } from './index.ts'
import v1Fixture from './fixtures/v1.json' with { type: 'json' }

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
    const before = envelope.payload as { clubs: unknown[]; season: { startYear: number } }
    const after = readSave(envelope).payload as typeof before

    expect(after.clubs).toEqual(before.clubs)
    expect(after.season.startYear).toBe(before.season.startYear)
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
