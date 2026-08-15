import { describe, expect, it } from 'vitest'
import { bestXI, type Formation } from './lineup.ts'
import type { Player, Position } from './player.ts'
import { simulateSeasons } from './simulate.ts'
import type { GameState } from './state.ts'
import { computeTable } from './table.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'

/**
 * The formation sweep — the gap `docs/roadmap.md` named as a known open item:
 * the main harness runs every club on 4-4-2 balanced, so it cannot see a lever
 * whose right answer is a fixed end stop. That is the class of bug M3a's slider
 * and M5b's ticket price both shipped, and formation grew a calibrated constant
 * (`FORMATION_TEMPO`) which could do it a third time.
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

const SEASONS = 10
const SEED = 20260813

const clubs = TEST_CLUBS
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
      names: TEST_NAMES,
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

// --- strength: does the best shape run with how good the club is? ---
const strongFlat = points(strongest.id, { formation: '4-4-2' })
const strongContain = points(strongest.id, { formation: '4-5-1' })
const weakFlat = points(weakest.id, { formation: '4-4-2' })
const weakContain = points(weakest.id, { formation: '4-5-1' })

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

describe(`formation is a decision, not a cost — over ${SEASONS} seasons`, () => {
  it('punishes a strong club for containing the game', () => {
    // Measured ~9 points. A strong side wants the match open; smothering it
    // trades away exactly the advantage it has.
    expect(strongFlat).toBeGreaterThan(strongContain + 2)
  })

  it('rewards a weak club for the same shape', () => {
    // Measured ~3.4 points. Fewer goals means more draws, and a draw is worth
    // far more to the side that would otherwise lose — the M3c mechanism, now
    // reachable through the team sheet as well as the slider.
    expect(weakContain).toBeGreaterThan(weakFlat + 1.5)
  })

  it('has no shape that suits everybody', () => {
    // The criterion. If one shape were best at both ends of the table it would be
    // a dominant strategy and the buttons would be decoration — which is exactly
    // what 4-5-1 was before `FORMATION_TEMPO`, at −1.6 points and optimal nowhere.
    //
    // Asserted as a gradient rather than an argmax: gaps between these arms run to
    // 9 points, where an argmax over eight shapes can flip on a couple of points
    // of season variance.
    const strongPrefersContainment = strongContain > strongFlat
    const weakPrefersContainment = weakContain > weakFlat
    expect(strongPrefersContainment).not.toBe(weakPrefersContainment)
  })
})

describe('formation follows the squad, not only its strength', () => {
  it('rewards the shape the squad is actually built for', () => {
    // Same club, same seed, same fixtures — only which bank was hollowed out.
    // Measured +7.3.
    expect(gapThinMidfield).toBeGreaterThan(2)
  })

  it('punishes that shape when the squad is built the other way', () => {
    // Measured −5.7. This is the half that a strength-only test cannot see, and
    // the reason the main harness — which runs generated, uniformly-scaled squads
    // in 4-4-2 — is blind to formation exploits.
    expect(gapThinAttack).toBeLessThan(-2)
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
