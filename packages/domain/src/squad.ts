import type { Club } from './entities.ts'
import { bestXI, teamRating } from './lineup.ts'
import { expectedWage } from './valuation.ts'
import {
  type Attributes,
  ATTRIBUTE_KEYS,
  clampRating,
  contractExpiry,
  type Player,
  type PlayerId,
  type Position,
} from './player.ts'
import type { Rng } from './rng.ts'
import { addDays, type DayNumber, fromCivil, toCivil } from './time.ts'

/**
 * Squad generation. Deterministic from `(club, rng)` — the same seed always builds
 * the same league.
 *
 * The binding requirement is a **round trip**: a club whose provisional rating was
 * 88/85 must produce a squad whose best XI collapses back to roughly 88/85. M2's
 * calibration was tuned against club-level ratings, so if generation does not
 * reproduce them the harness bands move and the whole milestone's tuning is lost.
 * `calibrateSquad` below is what enforces that, and the harness is what proves it.
 *
 * Names are supplied by the caller (`@fm/data` owns the word lists — content never
 * lives in `domain`).
 */

/** Squad shape. Two spare keepers and depth everywhere: M6 adds injuries. */
const SQUAD_SHAPE: Readonly<Record<Position, number>> = { GK: 3, DF: 8, MF: 7, FW: 5 }

export const SQUAD_SIZE = Object.values(SQUAD_SHAPE).reduce((a, b) => a + b, 0)

/**
 * Which attributes matter for each position. Generation pushes these up and the
 * rest down, so a squad reads like a squad — a centre-back who cannot finish, a
 * striker who cannot tackle — rather than 23 generalists.
 */
const KEY_ATTRIBUTES: Readonly<Record<Position, readonly (keyof Attributes)[]>> = {
  GK: ['keeping'],
  DF: ['tackling', 'heading', 'pace', 'stamina'],
  MF: ['passing', 'stamina', 'dribbling', 'tackling'],
  FW: ['finishing', 'pace', 'dribbling', 'heading'],
}

/** How far a squad player can sit below the club's headline strength. */
const DEPTH_FALLOFF = 14
/** Per-attribute jitter, so no two players are identical. */
const NOISE = 6

export interface SquadOptions {
  /** Full names, at least `SQUAD_SIZE` of them. Supplied by `@fm/data`. */
  readonly names: readonly string[]
  /** Used to derive birth dates, so ages are relative to the season, not to a clock. */
  readonly seasonStart: DayNumber
}

export function generateSquad(club: Club, rng: Rng, options: SquadOptions): Player[] {
  const players: Player[] = []
  let index = 0

  for (const position of ['GK', 'DF', 'MF', 'FW'] as const) {
    const count = SQUAD_SHAPE[position]

    for (let depth = 0; depth < count; depth++) {
      // The first-choice player sits at the club's level; depth falls away from
      // there, so the best XI reflects club strength and the bench does not.
      const decline = (depth / Math.max(1, count - 1)) * DEPTH_FALLOFF
      const attackBase = club.attack - decline
      const defenceBase = club.defence - decline

      const name = options.names[index % options.names.length] ?? `Player ${index + 1}`
      const birthDate = birthDateFor(options.seasonStart, rng)
      players.push({
        id: `${club.id}-p${String(index + 1).padStart(2, '0')}` as PlayerId,
        name,
        position,
        birthDate,
        attributes: attributesFor(position, attackBase, defenceBase, rng),
        // Staggered 1-4 years so a whole league does not come out of contract in
        // the same summer, which would make one window do all the business.
        contract: {
          until: contractExpiry(toCivil(options.seasonStart).y + 1 + Math.floor(rng.next() * 4)),
          wage: 0, // set by calibrateSquad once attributes are final
        },
      })
      index++
    }
  }

  return calibrateSquad(club, players, options.seasonStart)
}

function attributesFor(
  position: Position,
  attackBase: number,
  defenceBase: number,
  rng: Rng,
): Attributes {
  const key = new Set(KEY_ATTRIBUTES[position])
  // Attacking positions are built off the club's attack rating, defensive ones off
  // its defence, so a club strong at the back generates defenders to match.
  const base = position === 'FW' || position === 'MF' ? attackBase : defenceBase

  const built = {} as Record<keyof Attributes, number>
  for (const attribute of ATTRIBUTE_KEYS) {
    const relevant = key.has(attribute)
    let value = relevant ? base + 4 : base - 12

    // Keeping is the exception in both directions: outfielders never have it, and
    // a keeper's other attributes are irrelevant to everything downstream.
    if (attribute === 'keeping' && position !== 'GK') value = 1 + rng.next() * 9
    else if (position === 'GK' && attribute !== 'keeping') value = base - 18

    built[attribute] = clampRating(value + (rng.next() - 0.5) * 2 * NOISE)
  }

  return built as Attributes
}

/** Ages 17–35, weighted toward the mid-20s by averaging two draws. */
function birthDateFor(seasonStart: DayNumber, rng: Rng): DayNumber {
  const spread = (rng.next() + rng.next()) / 2 // triangular, peaked at 0.5
  const age = 17 + Math.floor(spread * 19)
  const dayOfYear = Math.floor(rng.next() * 365)
  const born = fromCivil(toCivil(seasonStart).y - age, 1, 1)
  return addDays(born, dayOfYear)
}

/**
 * Nudges every attribute by a constant so the best XI collapses back to the club's
 * provisional rating.
 *
 * Without this the generation constants above would need hand-tuning to hit the
 * target, and any change to the position weights in `attribute-model.md` would
 * silently shift every club's strength. Solving for the offset instead makes the
 * round trip exact by construction — the generation constants control the *shape*
 * of a squad, and this controls its *level*.
 */
function calibrateSquad(club: Club, players: Player[], seasonStart: DayNumber): Player[] {
  let adjusted = players

  // Two passes converge well within a rating point: the mapping from a uniform
  // offset to team rating is close to linear but not exactly so, because of
  // clamping at the extremes.
  for (let pass = 0; pass < 2; pass++) {
    const rating = teamRating(startersFor(adjusted))
    const attackGap = club.attack - rating.attack
    const defenceGap = club.defence - rating.defence

    adjusted = adjusted.map((player) => {
      const gap = player.position === 'FW' || player.position === 'MF' ? attackGap : defenceGap
      const shifted = {} as Record<keyof Attributes, number>
      for (const attribute of ATTRIBUTE_KEYS) {
        const isDeadKeeping = attribute === 'keeping' && player.position !== 'GK'
        shifted[attribute] = isDeadKeeping
          ? player.attributes[attribute]
          : clampRating(player.attributes[attribute] + gap)
      }
      return { ...player, attributes: shifted as Attributes }
    })
  }

  // Wages follow the finished attributes, so they are priced after calibration.
  return adjusted.map((player) => ({
    ...player,
    contract: { ...player.contract, wage: expectedWage(player, seasonStart) },
  }))
}

/**
 * A single young player, to replace someone who has retired.
 *
 * Not the youth academy — that is M7, with scouting, development and fog-of-war.
 * This is the minimum that keeps a career alive: without *any* inflow, a league
 * that carries squads forward simply ages, and ten seasons in the average squad
 * is 34. The harness caught exactly that.
 *
 * Generated a little below the club's level, because a teenager is not a
 * first-teamer yet. M6's training curve is what will grow him.
 */
export function generateYouthPlayer(
  club: Club,
  position: Position,
  rng: Rng,
  options: SquadOptions & { readonly serial: string },
): Player {
  const base = position === 'FW' || position === 'MF' ? club.attack : club.defence
  const age = 17 + Math.floor(rng.next() * 3)
  const seasonYear = toCivil(options.seasonStart).y
  const name = options.names[Math.floor(rng.next() * options.names.length)] ?? 'Youth Player'

  const player: Player = {
    id: `${club.id}-y${options.serial}` as PlayerId,
    name,
    position,
    birthDate: addDays(fromCivil(seasonYear - age, 1, 1), Math.floor(rng.next() * 365)),
    attributes: attributesFor(position, base - YOUTH_GAP, base - YOUTH_GAP, rng),
    contract: {
      until: contractExpiry(seasonYear + 3 + Math.floor(rng.next() * 2)),
      wage: 0,
    },
  }

  return {
    ...player,
    contract: { ...player.contract, wage: expectedWage(player, options.seasonStart) },
  }
}

/** How far below the first team a newly promoted teenager starts. */
const YOUTH_GAP = 12

/**
 * Squads for a whole league, with names allocated so no two players share one.
 *
 * The pool is shuffled once from the same rng and then sliced per club, which is
 * why this exists rather than each club drawing independently: twenty clubs
 * drawing from the head of the same list would produce twenty identical rosters
 * of names.
 */
export function generateLeagueSquads(
  clubs: readonly Club[],
  rng: Rng,
  options: SquadOptions,
): Map<string, Player[]> {
  const needed = clubs.length * SQUAD_SIZE
  if (options.names.length < needed) {
    throw new Error(`Need ${needed} names for ${clubs.length} clubs, got ${options.names.length}`)
  }

  const pool = shuffle(options.names, rng)
  const squads = new Map<string, Player[]>()

  clubs.forEach((club, index) => {
    const slice = pool.slice(index * SQUAD_SIZE, (index + 1) * SQUAD_SIZE)
    squads.set(club.id, generateSquad(club, rng, { ...options, names: slice }))
  })

  return squads
}

/** Fisher–Yates over the injected rng — no `Math.random`, so a seed reproduces the league. */
function shuffle(values: readonly string[], rng: Rng): string[] {
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const a = result[i]
    const b = result[j]
    /* c8 ignore next */
    if (a === undefined || b === undefined) continue
    result[i] = b
    result[j] = a
  }
  return result
}

function startersFor(players: readonly Player[]): Player[] {
  const lineup = bestXI(players, '4-4-2')
  const byId = new Map(players.map((p) => [p.id, p]))
  return lineup.starters.flatMap((id) => {
    const player = byId.get(id)
    /* c8 ignore next */
    return player === undefined ? [] : [player]
  })
}
