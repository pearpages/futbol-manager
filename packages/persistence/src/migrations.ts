/**
 * The save migration chain. Ground rule 3 and ADR 0005: every schema change ships
 * a migration plus a round-trip test against the previous version's fixture save.
 *
 * **Forward-only.** There is no downgrade path — shipping a version means
 * committing to migrating away from it.
 *
 * Payloads here are deliberately typed `unknown` rather than as `GameState`. A
 * migration operates on the shape a *past* version wrote, which by definition is
 * not the current type; typing it as the current one would compile happily and be
 * wrong. Each migration narrows what it needs and no more.
 */

export interface Migration {
  readonly from: number
  readonly to: number
  readonly describe: string
  migrate(payload: unknown): unknown
}

/**
 * v1 → v2: players arrive.
 *
 * A v1 save has clubs with `attack`/`defence` but no squads, so there is nothing
 * to derive players *from* beyond those ratings. Rather than invent a squad here —
 * which would need generation logic, and `persistence` must not depend on it — the
 * migration marks the save as needing squads. The loader generates them from the
 * club ratings, exactly as a new season does.
 */
const v1ToV2: Migration = {
  from: 1,
  to: 2,
  describe: 'players and lineups added to GameState',
  migrate(payload) {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('v1 save payload is not an object')
    }
    return { ...payload, squads: {}, lineups: {}, tactics: {} }
  },
}

/** Ordered, contiguous, forward-only. `migrateSave` walks this list. */
export const MIGRATIONS: readonly Migration[] = [v1ToV2]

export const SCHEMA_VERSION = MIGRATIONS.length === 0 ? 1 : (MIGRATIONS.at(-1)?.to ?? 1)

/**
 * Walks a payload from `fromVersion` up to {@link SCHEMA_VERSION}.
 *
 * Throws rather than guessing on a version from the future — that means a save
 * written by a newer build, and silently loading it would corrupt a career.
 */
export function migratePayload(payload: unknown, fromVersion: number): unknown {
  if (fromVersion > SCHEMA_VERSION) {
    throw new Error(
      `Save is version ${fromVersion}, but this build only understands up to ${SCHEMA_VERSION}. Update the game.`,
    )
  }
  if (fromVersion < 1) throw new Error(`Invalid save version: ${fromVersion}`)

  let current = payload
  let version = fromVersion

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS.find((m) => m.from === version)
    /* c8 ignore next */
    if (step === undefined) throw new Error(`No migration from version ${version}`)
    current = step.migrate(current)
    version = step.to
  }

  return current
}

/** True when a migrated save still needs its squads generated — see the v1→v2 note. */
export function needsSquads(payload: unknown): boolean {
  if (typeof payload !== 'object' || payload === null) return false
  const squads = (payload as { squads?: unknown }).squads
  return typeof squads !== 'object' || squads === null || Object.keys(squads).length === 0
}
