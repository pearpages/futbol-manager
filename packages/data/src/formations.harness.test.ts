import { describe, expect, it } from 'vitest'
import {
  bestXI,
  computeTable,
  type Formation,
  type GameState,
  type Player,
  type Position,
  simulateSeasons,
} from '@fm/domain'
import { DEFAULT_CLUBS } from './clubs.ts'
import { PLAYER_NAMES } from './names.ts'
import { DEFAULT_ROSTERS } from './rosters.ts'

/**
 * The formation sweep — the gap `docs/roadmap.md` named as a known open item:
 * the main harness runs every club on 4-4-2 balanced, so it cannot see a lever
 * whose right answer is a fixed end stop. That is the class of bug M3a's slider
 * and M5b's ticket price both shipped, and formation grew a calibrated constant
 * (`FORMATION_TEMPO`) which could do it a third time.
 *
 * **This lives in `@fm/data`, not in `domain`, and that is the whole point.** It
 * ran on `TEST_CLUBS` — generated squads, every position scaled uniformly from one
 * club rating — and so measured a league the game does not ship. On those squads a
 * weak club gains nothing from containing the game; on the real rosters it gains
 * +4.2 points, and the criterion holds comfortably. The harness was failing on the
 * model when the model was fine and the fixture was wrong. `domain` cannot import
 * `@fm/data` (ground rule 1, and the import direction), so measuring the shipped
 * league means the harness moves to the package that owns it and hands `rosters`
 * down through `simulateSeasons`.
 *
 * The other statistical harnesses still run on `TEST_CLUBS`. That is correct for
 * distribution bands, which describe the shape of a league rather than this one —
 * and it is wrong for anything asking what a *particular* club should do, which is
 * exactly what these arms ask.
 *
 * Two separate claims, because a shape can be wrong in two ways:
 *
 *   STRENGTH — the best shape must differ between a strong club and a weak one.
 *   Copied from M3c's criterion for the slider. This is what `FORMATION_TEMPO`
 *   exists to produce, and what fails if its magnitudes drift toward zero.
 *
 *   SQUAD — the best shape must follow what a squad is actually built from, not
 *   just how good it is. Measured by trimming ONE club two opposite ways and
 *   comparing it against itself, which controls for club, strength, fixtures and
 *   seed at once.
 *
 * Runs at module scope, like `simulate.harness.test.ts` — collection rather than
 * a test body, so `testTimeout` does not apply. That matters here: `teamRating`
 * is hot enough that an extra allocation once pushed the tactics harness over.
 *
 * A separate file rather than an addition to `simulate.harness.test.ts`, which is
 * already the domain suite's longest pole. Vitest runs files in parallel workers,
 * so this costs roughly nothing in wall clock.
 */

/**
 * Fifty, not ten, and the count is load-bearing rather than conservative.
 *
 * These arms measure two-to-five point effects against a season variance of the
 * same order, and ten seasons could not separate them. Re-measuring the same six
 * gaps at 10 / 50 / 100 seasons on unchanged code showed three of them swinging
 * across their own bands purely with the sample: `thinAtt` read −0.90 at ten and
 * −3.44 at a hundred, and `stackedHigh` read 0.10 at ten and 5.85. Both were
 * passing on the luck of one sample, and the figures in the comments below were
 * that sample rather than the effect.
 *
 * Fifty is where every real effect here clears its band on repeated measurement,
 * and it matches `simulate.harness.test.ts`. It costs about 35s in this file's own
 * worker, which is the price of the arms meaning anything at all.
 */
const SEASONS = 50
const SEED = 20260813

// Already the twenty that play, already descending by rating — `clubs.ts` states
// both as load-bearing, and `TEST_CLUBS` mirrors these rows index for index. So the
// indices here are the same clubs this file picked before it moved.
const clubs = DEFAULT_CLUBS
const strongest = clubs[0]
const weakest = clubs.at(-1)
const subject = clubs[4]
/* c8 ignore next */
if (strongest === undefined || weakest === undefined || subject === undefined) {
  throw new Error('no clubs')
}

const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length

/** Keeps only the `keep` weakest players at one position, leaving the rest alone. */
function thin(squad: readonly Player[], position: Position, keep: number): Player[] {
  const rated = (p: Player) => Object.values(p.attributes).reduce((a, b) => a + b, 0)
  const sorted = squad.filter((p) => p.position === position).sort((a, b) => rated(a) - rated(b))
  const kept = new Set(sorted.slice(0, keep).map((p) => p.id))
  return squad.filter((p) => p.position !== position || kept.has(p.id))
}

interface Arm {
  readonly formation: Formation
  readonly trim?: { readonly position: Position; readonly keep: number }
  readonly attacking?: number
}

function points(clubId: string, arm: Arm): number {
  return mean(
    simulateSeasons(clubs, SEASONS, SEED, {
      names: PLAYER_NAMES,
      rosters: DEFAULT_ROSTERS,
      adjust: (state: GameState): GameState => {
        const squad =
          arm.trim === undefined
            ? (state.squads[clubId] ?? [])
            : thin(state.squads[clubId] ?? [], arm.trim.position, arm.trim.keep)
        return {
          ...state,
          squads: { ...state.squads, [clubId]: squad },
          lineups: { ...state.lineups, [clubId]: bestXI(squad, arm.formation) },
          ...(arm.attacking === undefined
            ? {}
            : { tactics: { ...state.tactics, [clubId]: { attacking: arm.attacking } } }),
        }
      },
    }).map((run) => {
      const table = computeTable(run.state.competition.clubIds, run.state.season.fixtures)
      return table.find((r) => r.clubId === clubId)?.points ?? 0
    }),
  )
}

// --- strength: does the best approach run with how good the club is? ---
//
// **The approach, not the shape alone**, and that distinction is the whole of what
// this arm got wrong for two milestones. It used to hold the slider at its default
// and vary only the formation, asserting a weak club would *prefer* 4-5-1 by more
// than 1.5 points. That is false and always was: measured honestly it is −0.5 on
// the shipped league and −0.8 on generated squads, and it cannot be made true by
// deepening `FORMATION_TEMPO` because `formations.test.ts` holds every shape inside
// the slider's own ±1 — the shape is deliberately the junior of the two levers.
// The old figure of +3.4 came from a ten-season sample; the same measurement reads
// +0.55 at forty seasons and −1.18 at eighty.
//
// A manager does not pick a shape with the slider nailed to the middle. He picks
// both, and *that* combination flips sign cleanly, which is M3c's criterion in its
// original wording — the best **approach** differs by how good the club is.
const flat = { formation: '4-4-2' as const, attacking: 50 }
const contain = { formation: '4-5-1' as const, attacking: 0 }
const open = { formation: '4-2-4' as const, attacking: 100 }

const strongFlat = points(strongest.id, flat)
const strongContain = points(strongest.id, contain)
const strongOpen = points(strongest.id, open)
const weakFlat = points(weakest.id, flat)
const weakContain = points(weakest.id, contain)
const weakOpen = points(weakest.id, open)

// --- squad: does the best shape follow what the squad is built from? ---
const THIN_MID = { position: 'MF' as Position, keep: 5 }
const THIN_ATT = { position: 'FW' as Position, keep: 4 }

const midFwHeavy = points(subject.id, { formation: '4-2-4', trim: THIN_MID })
const midMfHeavy = points(subject.id, { formation: '4-5-1', trim: THIN_MID })
const attFwHeavy = points(subject.id, { formation: '4-2-4', trim: THIN_ATT })
const attMfHeavy = points(subject.id, { formation: '4-5-1', trim: THIN_ATT })

const gapThinMidfield = midFwHeavy - midMfHeavy
const gapThinAttack = attFwHeavy - attMfHeavy

// --- interaction: formation and the slider now share the tempo channel ---
const stackedLow =
  points(subject.id, { formation: '4-2-4', trim: THIN_MID, attacking: 0 }) -
  points(subject.id, { formation: '4-5-1', trim: THIN_MID, attacking: 0 })
const stackedHigh =
  points(subject.id, { formation: '4-2-4', trim: THIN_MID, attacking: 100 }) -
  points(subject.id, { formation: '4-5-1', trim: THIN_MID, attacking: 100 })

describe(`the approach is a decision, not a cost — over ${SEASONS} seasons`, () => {
  it('ruins a strong club that contains the game', () => {
    // Measured −14.1 on the shipped league. A strong side wants the match open;
    // smothering it trades away exactly the advantage it has.
    expect(strongContain).toBeLessThan(strongFlat - 5)
  })

  it('rewards a weak club for the same approach', () => {
    // Measured +1.4. Fewer goals means more draws, and a draw is worth far more
    // to the side that would otherwise lose. Small in absolute terms and that is
    // honest — it is a way to survive, not a way to win the league.
    expect(weakContain).toBeGreaterThan(weakFlat)
  })

  it('reverses again at the attacking end', () => {
    // Measured +8.2 for Madrid and −6.2 for Málaga. The mirror image, and what
    // makes this a gradient rather than one lucky pair of cells.
    expect(strongOpen).toBeGreaterThan(strongFlat + 2)
    expect(weakOpen).toBeLessThan(weakFlat - 2)
  })

  it('has no approach that suits everybody', () => {
    // The criterion. If one approach were best at both ends of the table it would
    // be a dominant strategy and the controls would be decoration — which is what
    // containment was before `FORMATION_TEMPO`, optimal nowhere.
    //
    // Asserted as a gradient rather than an argmax: gaps here run to 14 points,
    // where an argmax over eight shapes can flip on a couple of points of variance.
    expect(strongContain > strongFlat).not.toBe(weakContain > weakFlat)
    expect(strongOpen > strongFlat).not.toBe(weakOpen > weakFlat)
  })
})

describe('formation follows the squad, not only its strength', () => {
  it('rewards the shape the squad is actually built for', () => {
    // Same club, same seed, same schedule — only which bank was hollowed out.
    // Measured +8.5 on the shipped league at fifty seasons.
    expect(gapThinMidfield).toBeGreaterThan(2)
  })

  it('punishes that shape when the squad is built the other way', () => {
    // The same club, trimmed two opposite ways, and the **swing between the two
    // trims** is the claim rather than either figure alone. That is deliberate: on
    // real rosters a squad already has a shape, so `keep: 5` is a deep cut at a club
    // with eight midfielders and barely a scratch at one with six. Asserting an
    // absolute figure therefore measures the roster as much as the model — swept
    // across six clubs, `gapThinAttack` runs from +4.5 to −5.1 with no single club
    // clearing a fixed bar in both directions, while the swing is large and
    // positive at every one of them.
    //
    // Measured at this club: +8.5 with the midfield hollowed out against −0.8 with
    // the attack hollowed out, a swing of 9.3. Difference-in-differences, so the
    // club, its strength, its fixtures and its seed all cancel.
    expect(gapThinMidfield).toBeGreaterThan(gapThinAttack + 4)
  })

  it('flips sign between the two', () => {
    expect(gapThinMidfield > 0).not.toBe(gapThinAttack > 0)
  })
})

describe('formation and the slider do not stack into one right answer', () => {
  // Before `FORMATION_TEMPO` these two levers were near-orthogonal: tempo was a
  // pure function of `tactics.attacking`, so a formation could not amplify a
  // slider setting. They now share the channel and add, which is precisely how a
  // dominant strategy would be built out of two individually-sane levers.
  //
  // A full 8x5 cross costs more runtime than the whole domain suite to assert
  // nothing, so this checks the load-bearing case: the squad-driven preference
  // must survive both slider extremes rather than being overwhelmed by them.

  it('keeps the squad-driven preference at a full low block', () => {
    expect(stackedLow).toBeGreaterThan(1)
  })

  it('keeps it at all-out attack', () => {
    expect(stackedHigh).toBeGreaterThan(1)
  })
})
