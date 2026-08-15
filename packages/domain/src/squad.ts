import type { Club } from './entities.ts'
import { ATTACK_WEIGHTS, bestXI, DEFENCE_WEIGHTS, teamRating } from './lineup.ts'
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
  DF: ['tackling', 'heading', 'stamina'],
  MF: ['passing', 'stamina', 'dribbling', 'tackling', 'finishing'],
  FW: ['finishing', 'pace', 'dribbling', 'heading', 'passing'],
}

/** Per-attribute jitter, so no two players are identical. */
const NOISE = 3.0

/**
 * One player in a supplied roster — a squad *shape* rather than a squad.
 *
 * Content lives in `@fm/data`; this is only the type the boundary is described in.
 */
export interface RosterEntry {
  readonly name: string
  readonly position: Position
  /** Age at the season start. Taken literally, not drawn. */
  readonly age: number
  /**
   * His market value, and **the magnitude is read, not just the order**.
   *
   * It used to be a sort key alone, which is what made every squad in the league the
   * same ten-point block: the gap between a group's best and worst was a constant, and
   * the *spacing* came from how many players happened to play there rather than from
   * money. See `VALUE_DECAY` and `SPREAD_K`.
   *
   * The *level* of a squad still comes from the club rating — `calibrateSquad` pins the
   * XI to it either way — so this sets shape, never absolute quality. And it is still
   * not a price: wages and fees are computed by `valuation.ts` from the finished
   * attributes, never from this column.
   */
  readonly value: number
}

export interface SquadOptions {
  /** Full names, at least `SQUAD_SIZE` of them. Supplied by `@fm/data`. */
  readonly names: readonly string[]
  /** Used to derive birth dates, so ages are relative to the season, not to a clock. */
  readonly seasonStart: DayNumber
  /**
   * A real squad shape for this club. Absent means generate one, which is what the
   * harness and every domain test do — `TEST_CLUBS` ships no rosters, so the
   * statistical bands still run on generated squads.
   */
  readonly roster?: readonly RosterEntry[]
  /**
   * Typical market value of a player at each position, across the whole league.
   *
   * **Without it, every position group's best player sits at decline zero** — so a
   * €200M forward and a club's fourth-choice centre-back come out level, and nobody
   * is a star. Measured: the league topped out at 90 with three players there.
   *
   * It cannot simply be squad-wide value, because keepers are cheap in absolute terms
   * and would all read as filler. Dividing by what a player at *that* position
   * normally costs makes the signal comparable across positions: Courtois at €15M
   * against a keeper norm of a couple of million is elite; a €15M forward is not.
   *
   * Supplied by `generateLeagueSquads`, which is the only caller that can see every
   * roster at once. Absent means fall back to comparing within the group.
   */
  readonly reference?: Readonly<Partial<Record<Position, number>>>
}

/** Position groups in a fixed order, so generation is deterministic. */
const GROUPS = ['GK', 'DF', 'MF', 'FW'] as const

interface Slot {
  readonly position: Position
  readonly name: string | null
  readonly age: number | null
  /** How far below the club's own level this player sits, in rating points. */
  readonly decline: number
}

/**
 * How wide a squad is, top to bottom, as a share of the club's rating.
 *
 * **It used to be one flat number for everybody, and that was the whole bug.** Every
 * squad in the league came out as the same ~10-point block translated up or down —
 * Madrid's worst player was 81 and Barcelona's 82, so neither had anyone below 80,
 * while all hundred of the league's 80+ players sat in three clubs.
 *
 * A fixed width cannot work: twenty points below Málaga's 71 is 51, far under the
 * floor, and clamping would pile its entire reserve list onto exactly 60. Scaling with
 * the club says something truer anyway — **a better club has a more varied squad**,
 * with genuine stars at the top and squad players a long way below them, where a
 * struggling club is uniformly modest.
 */
const SPREAD_K = 0.72

/**
 * The rating a club would have to sink to before its squad stopped varying at all.
 *
 * Spread scales with `rating − SPREAD_FLOOR`, **not with the rating itself**, and the
 * difference is the whole reason the floor holds. Málaga's XI averages 69: sixteen
 * points of spread below that is 53, and thirty players went under 60 when this was
 * proportional. Measuring from a floor gives Madrid more than twice Málaga's range
 * instead of a third more — which is also the truer statement, since the gap between a
 * superstar and a squad player is far wider at a rich club than at a poor one.
 */
const SPREAD_FLOOR = 55.36

/**
 * Rating points per natural-log unit of market value, inside a position group.
 *
 * **`value` used to be a sort key and nothing else**, so the gap between the best and
 * worst of a group was always exactly `DEPTH_FALLOFF` and the *spacing* came from how
 * many players happened to play there. Madrid's two keepers, at €15M and €12M, came out
 * eleven points apart because the group had two members and the second one ate the
 * entire falloff. Barcelona's €800k third keeper came out an 84 — better than anyone at
 * seventeen clubs.
 *
 * Reading the magnitude fixes both directions at once: near-equal values land near each
 * other, and a genuine standout stands clear.
 */
const VALUE_DECAY = 4.19

/**
 * The slots to fill: either the generator's flat shape, or the real one.
 *
 * Each carries its own `decline`, because the two paths derive it differently — the
 * roster path from the value curve, the generated path from rank. Keeping it here
 * rather than in `generateSquad` is what lets them disagree about *shape* while
 * `calibrateSquad` still pins both to the same *level*.
 *
 * **Value is compared against the league norm for the player's position, then across
 * the whole squad.** Both halves are needed. Raw value across a squad would rate every
 * goalkeeper as filler, because keepers are cheap — Courtois at €15M against Mbappé at
 * €200M. But comparing only *within* a position group is what made the first attempt
 * fail the other way: every group's best player sat at decline zero, so a €200M forward
 * and a fourth-choice centre-back came out level and the league topped out at 90 with
 * three players there. Dividing by the position norm first makes the two comparable, so
 * a star can stand above his own team-mates rather than merely above his understudies.
 */
function slotsFor(club: Club, options: SquadOptions): Slot[] {
  const spread = SPREAD_K * ((club.attack + club.defence) / 2 - SPREAD_FLOOR)
  const roster = options.roster

  if (roster === undefined) {
    // No roster: fall back to even rank spacing. **This must stay as wide as the
    // roster path** — `TEST_CLUBS` ships no rosters, so the harness and every domain
    // test come through here, and a narrower fallback would mean the bands measure a
    // differently-shaped league from the one that ships.
    return GROUPS.flatMap((position) => {
      const count = SQUAD_SHAPE[position]
      return Array.from({ length: count }, (_, depth) => ({
        position,
        name: null,
        age: null,
        decline: (depth / Math.max(1, count - 1)) * spread,
      }))
    })
  }

  // How good a player looks *for his position*: his value against the league norm
  // for that position. Falls back to his own group's best when no reference is given.
  const reference = options.reference
  const signal = (entry: RosterEntry): number =>
    Math.log(Math.max(entry.value, 1) / Math.max(reference?.[entry.position] ?? 1, 1))
  const best = reference === undefined ? 0 : Math.max(...roster.map(signal))

  return GROUPS.flatMap((position) => {
    const group = roster
      .filter((entry) => entry.position === position)
      .sort((a, b) => b.value - a.value)
    const groupTop =
      reference === undefined ? signal(group[0] ?? ({ value: 1 } as RosterEntry)) : best

    return group.map((entry) => ({
      position,
      name: entry.name,
      age: entry.age,
      // Capped, because a squad's value range can span three decades — Málaga's €10M
      // forward against its €25k defender — and without a cap that alone would put
      // half a squad through the floor.
      decline: Math.min(spread, VALUE_DECAY * Math.max(0, groupTop - signal(entry))),
    }))
  })
}

export function generateSquad(club: Club, rng: Rng, options: SquadOptions): Player[] {
  const players: Player[] = []
  const slots = slotsFor(club, options)
  let index = 0

  for (const position of GROUPS) {
    const inPosition = slots.filter((slot) => slot.position === position)

    for (const slot of inPosition) {
      // The first-choice player sits at the club's level; the rest fall away from
      // there, so the best XI reflects club strength and the bench does not.
      const attackBase = club.attack - slot.decline
      const defenceBase = club.defence - slot.decline

      const { name: rosterName, age } = slot
      const name =
        rosterName ?? options.names[index % options.names.length] ?? `Player ${index + 1}`
      // A real age is taken as given; a generated one is drawn.
      const birthDate =
        age === null
          ? birthDateFor(options.seasonStart, rng)
          : birthDateAt(options.seasonStart, age, rng)
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

/**
 * How far a position's key attributes sit above `base`, and its others below.
 *
 * **Per position, and solved rather than picked.** It was a flat `+4 / −12` for every
 * position, which gave the generator a systematic bias: GK averaged 52.3 and DF 55.2
 * against MF 63.9 and FW 63.7, with only fourteen keepers in the whole league reaching
 * 60. That is not a scale problem — it survives any rescale.
 *
 * The pair is chosen so a position's `overall` comes out **on** `base`. `overall`
 * spends `Σ POSITION_WEIGHTS` over the keys and the rest over the others, so the
 * condition is `Σ_key · boost = Σ_other · penalty` — and the two sides differ per
 * position because the key sets do. A keeper is the extreme case: `POSITION_WEIGHTS.GK`
 * puts 0.70 on `keeping` and spends the other 0.30 on attributes this function pushes
 * down, so the old `−18` cost him 2.6 points on its own.
 *
 * The sum `boost + penalty` is what controls how *spiky* a player looks on the ficha —
 * a centre-back who cannot finish. Only the ratio is pinned, so that stays a taste
 * decision.
 *
 * **Re-derive if `KEY_ATTRIBUTES` or `POSITION_WEIGHTS` change.** A test asserts the
 * four positions stay within two points of each other, so it will say so.
 */
const SHAPE: Readonly<Record<Position, { readonly boost: number; readonly penalty: number }>> = {
  GK: { boost: 2.0, penalty: 4.66 },
  DF: { boost: 2.0, penalty: 3.26 },
  MF: { boost: 0.82, penalty: 5.99 },
  FW: { boost: 0.52, penalty: 5.99 },
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
  const { boost, penalty } = SHAPE[position]
  for (const attribute of ATTRIBUTE_KEYS) {
    const relevant = key.has(attribute)
    let value = relevant ? base + boost : base - penalty

    // Keeping is the exception in both directions: outfielders never have it, and
    // a keeper's other attributes are irrelevant to everything downstream.
    if (attribute === 'keeping' && position !== 'GK') value = 45.58 + rng.next() * 4.49
    else if (position === 'GK' && attribute !== 'keeping') value = base - penalty

    built[attribute] = clampRating(value + (rng.next() - 0.5) * 2 * NOISE)
  }

  return built as Attributes
}

/** Ages 17–35, weighted toward the mid-20s by averaging two draws. */
function birthDateFor(seasonStart: DayNumber, rng: Rng): DayNumber {
  const spread = (rng.next() + rng.next()) / 2 // triangular, peaked at 0.5
  const age = 17 + Math.floor(spread * 19)
  return birthDateAt(seasonStart, age, rng)
}

/** A birth date for a known age. The day within the year is still drawn. */
function birthDateAt(seasonStart: DayNumber, age: number, rng: Rng): DayNumber {
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
/**
 * How much of the calibration offset an attribute takes, by which axis it serves.
 *
 * **This used to be chosen by the player's position** — `attackGap` for MF and FW,
 * `defenceGap` for GK and DF — and that is what made keepers read nine points below
 * forwards. Generation delivers defence more cheaply than attack, so the two gaps come
 * out different; splitting them by position meant the whole discrepancy landed on the
 * attackers as a bonus and on everyone else as a deficit.
 *
 * The trap, and it cost a while to see: **a per-position trim cannot fix that.** The
 * trim raises the position's contribution to the team rating, which lowers its own gap
 * by almost as much — `trim + gap` is a single quantity pinned by the round trip, so
 * moving one just moves the other back. Every correction was circular until the split
 * itself went.
 *
 * Keyed on the attribute instead, every player at a club takes the same offset vector
 * regardless of where he plays, so no position can be systematically favoured. When the
 * two gaps are equal it reduces to a uniform shift. When a club is lopsided — Getafe at
 * 61/55 — attack-serving attributes take more, so its forwards do out-rate its
 * defenders, which is the real thing rather than an artefact.
 *
 * `keeping` serves only defence, and for an outfielder it is dead weight the caller
 * skips entirely.
 */
function shiftFor(attribute: keyof Attributes, attackGap: number, defenceGap: number): number {
  const a = ATTACK_WEIGHTS[attribute] ?? 0
  const d = DEFENCE_WEIGHTS[attribute] ?? 0
  if (a + d === 0) return (attackGap + defenceGap) / 2 // serves neither; keep it level
  return (a * attackGap + d * defenceGap) / (a + d)
}

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
      const shifted = {} as Record<keyof Attributes, number>
      for (const attribute of ATTRIBUTE_KEYS) {
        const isDeadKeeping = attribute === 'keeping' && player.position !== 'GK'
        shifted[attribute] = isDeadKeeping
          ? player.attributes[attribute]
          : clampRating(player.attributes[attribute] + shiftFor(attribute, attackGap, defenceGap))
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
const YOUTH_GAP = 5.99

export interface LeagueOptions extends SquadOptions {
  /**
   * Real squad shapes, keyed by club id. A club with no entry gets a generated
   * squad, which is how `TEST_CLUBS` keeps every harness band on generated squads
   * while the shipped league uses real ones.
   */
  readonly rosters?: Readonly<Record<string, readonly RosterEntry[]>>
}

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
  options: LeagueOptions,
): Map<string, Player[]> {
  const rosters = options.rosters ?? {}
  // Only clubs without a roster draw from the name pool, so a fully-rostered league
  // needs none at all — and a partly-rostered one still needs enough for the rest.
  const needed = clubs.filter((club) => rosters[club.id] === undefined).length * SQUAD_SIZE
  if (options.names.length < needed) {
    throw new Error(`Need ${needed} names for ${clubs.length} clubs, got ${options.names.length}`)
  }

  const pool = shuffle(options.names, rng)
  const squads = new Map<string, Player[]>()
  const reference = referenceValues(Object.values(rosters))

  clubs.forEach((club, index) => {
    const slice = pool.slice(index * SQUAD_SIZE, (index + 1) * SQUAD_SIZE)
    const roster = rosters[club.id]
    squads.set(
      club.id,
      generateSquad(
        club,
        rng,
        roster === undefined
          ? { ...options, names: slice }
          : { ...options, names: slice, roster, reference },
      ),
    )
  })

  return squads
}

/**
 * The median value at each position across every roster supplied.
 *
 * Median rather than mean: a handful of €200M forwards would drag a mean far above
 * what a forward actually costs, and the point of this number is to say what *normal*
 * looks like for the position.
 */
function referenceValues(
  rosters: readonly (readonly RosterEntry[])[],
): Readonly<Partial<Record<Position, number>>> {
  const out: Partial<Record<Position, number>> = {}
  for (const position of GROUPS) {
    const values = rosters
      .flatMap((roster) => roster.filter((entry) => entry.position === position))
      .map((entry) => Math.max(entry.value, 1))
      .sort((a, b) => a - b)
    const median = values[Math.floor(values.length / 2)]
    if (median !== undefined) out[position] = median
  }
  return out
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
