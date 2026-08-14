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

/**
 * v2 → v3: the human takes a club.
 *
 * Before M3b every club was played by the AI, so a v2 save has no notion of "your"
 * club. Adopting the first in the competition is arbitrary but harmless — a v2 save
 * has no manager to disappoint, and the alternative is refusing to load it.
 */
const v2ToV3: Migration = {
  from: 2,
  to: 3,
  describe: 'managedClubId added — the human now manages one club',
  migrate(payload) {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('v2 save payload is not an object')
    }
    const competition = (payload as { competition?: { clubIds?: unknown } }).competition
    const clubIds = Array.isArray(competition?.clubIds) ? competition.clubIds : []
    return { ...payload, managedClubId: clubIds[0] ?? '' }
  },
}

/**
 * v3 → v4: contracts and money.
 *
 * A v3 save has squads but nobody under contract and no club with a budget, so a
 * transfer market has nothing to work with. Both are filled in from what the save
 * already knows — budgets from the club's rating, contracts staggered across the
 * next four summers so the whole league does not expire in one window.
 *
 * Deterministic rather than random: a migration that used an rng would produce a
 * different league every time the same save was loaded.
 */
const v3ToV4: Migration = {
  from: 3,
  to: 4,
  describe: 'contracts on players and transfer budgets on clubs',
  migrate(payload) {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('v3 save payload is not an object')
    }

    const save = payload as {
      clubs?: { id: string; attack?: number; defence?: number }[]
      season?: { startYear?: number }
      squads?: Record<string, { id: string }[]>
    }
    const startYear = save.season?.startYear ?? 2026

    const clubs = (save.clubs ?? []).map((club) => {
      const rating = ((club.attack ?? 50) + (club.defence ?? 50)) / 2
      return { ...club, budget: Math.round(400 * Math.pow(rating / 50, 4)) }
    })

    const squads: Record<string, unknown[]> = {}
    for (const [clubId, squad] of Object.entries(save.squads ?? {})) {
      squads[clubId] = squad.map((player, index) => ({
        ...player,
        contract: {
          // Staggered by squad position, so expiries spread over four summers.
          until: daysFromCivil(startYear + 1 + (index % 4), 6, 30),
          wage: 0,
        },
      }))
    }

    return { ...payload, clubs, squads }
  },
}

/**
 * v4 → v5: the human joins the market.
 *
 * A v4 save has a market that ran itself — the AI traded, and there was no way to
 * bid, no free-agent pool and nothing to keep a shortlist in. All three are empty
 * collections rather than derived state: an in-progress career has no pending
 * bids by definition, and inventing free agents for a league whose contracts were
 * all auto-renewed would put players on the market their clubs never released.
 *
 * The pool fills at the first rollover, which is the only place a contract has
 * ever been allowed to lapse.
 */
const v4ToV5: Migration = {
  from: 4,
  to: 5,
  describe: 'bids, free agents and the shortlist — the human enters the market',
  migrate(payload) {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('v4 save payload is not an object')
    }
    return { ...payload, bids: [], freeAgents: [], shortlist: [] }
  },
}

/**
 * Howard Hinnant's `days_from_civil`, duplicated from `domain/time.ts`.
 *
 * `persistence` must not import `domain` for this: a migration has to keep
 * producing the same output forever, and importing a live function means a future
 * change there silently rewrites how an old save is read.
 */
function daysFromCivil(y: number, m: number, d: number): number {
  const year = m <= 2 ? y - 1 : y
  const era = Math.floor(year / 400)
  const yoe = year - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** Ordered, contiguous, forward-only. `migratePayload` walks this list. */
export const MIGRATIONS: readonly Migration[] = [v1ToV2, v2ToV3, v3ToV4, v4ToV5]

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
