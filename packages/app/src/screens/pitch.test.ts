import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FORMATION_NAMES, FORMATIONS, type Position } from '@fm/domain'
import { laneX, PITCH_VIEWBOX, pitchSlots, SLOT_RADIUS } from '@fm/design-system'

/**
 * The pitch's geometry, tested without a DOM — the `radar.test.ts` arrangement,
 * for the same reason: the app project runs with `css: false` and jsdom has no
 * layout, so nothing rendered can see any of this.
 */

const POSITIONS: readonly Position[] = ['GK', 'DF', 'MF', 'FW']

/** The XI a formation implies, in the order `pickXI` builds `starters`. */
function positionsFor(formation: (typeof FORMATION_NAMES)[number]): Position[] {
  const shape = FORMATIONS[formation]
  return POSITIONS.flatMap((position) => Array<Position>(shape[position]).fill(position))
}

const [, , viewWidth, viewHeight] = PITCH_VIEWBOX.split(' ').map(Number)

describe('lanes', () => {
  it('centres a bank of one, and mirrors every other', () => {
    expect(laneX(0, 1)).toBe(50)

    for (let count = 2; count <= 5; count++) {
      for (let i = 0; i < count; i++) {
        // `+ 0.5` is what centres a bank; `+ 1` or `+ 0` shifts the whole row.
        expect(laneX(i, count) + laneX(count - 1 - i, count), `${i}/${count}`).toBeCloseTo(100, 6)
      }
    }
  })

  it('gives a small bank room instead of spreading it to the touchlines', () => {
    // Two strikers across the full width read as a tactic rather than as two
    // strikers. The lane is fixed until the bank outgrows the pitch.
    expect(laneX(0, 2)).toBe(39)
    expect(laneX(1, 2)).toBe(61)
  })
})

describe('slots', () => {
  it('returns one point per player, in the order given', () => {
    const positions: Position[] = ['GK', 'DF', 'DF', 'MF', 'FW']
    const slots = pitchSlots(positions)

    expect(slots).toHaveLength(positions.length)
    // The GK came first in, so his point is first out — which is what lets the
    // caller zip the result against `startersOf` without re-sorting anything.
    expect(slots[0]?.y).toBeGreaterThan(slots[4]?.y ?? 0)
  })

  it('stacks the banks from our goal to theirs', () => {
    // Swapping two entries in `BAND_Y` would render an entirely plausible pitch
    // with the defence in front of the attack, and nothing else would notice.
    const [gk, df, mf, fw] = pitchSlots(['GK', 'DF', 'MF', 'FW'])

    expect(gk?.y).toBeGreaterThan(df?.y ?? 0)
    expect(df?.y).toBeGreaterThan(mf?.y ?? 0)
    expect(mf?.y).toBeGreaterThan(fw?.y ?? 0)
  })

  it('fits all eight shapes on the pitch without anyone overlapping', () => {
    // The test that earns the generic formula. Five across is the tightest bank
    // in the game (3-5-2, 4-5-1) and clears a 15-unit disc by 1.8 units; drop
    // SLOT_SPAN and the five-man banks touch.
    for (const formation of FORMATION_NAMES) {
      const slots = pitchSlots(positionsFor(formation))
      expect(slots, formation).toHaveLength(11)

      for (const slot of slots) {
        expect(slot.x, `${formation} x`).toBeGreaterThanOrEqual(SLOT_RADIUS)
        expect(slot.x, `${formation} x`).toBeLessThanOrEqual((viewWidth ?? 0) - SLOT_RADIUS)
        expect(slot.y, `${formation} y`).toBeGreaterThanOrEqual(SLOT_RADIUS)
        expect(slot.y, `${formation} y`).toBeLessThanOrEqual((viewHeight ?? 0) - SLOT_RADIUS)
      }

      for (let a = 0; a < slots.length; a++) {
        for (let b = a + 1; b < slots.length; b++) {
          const one = slots[a]
          const two = slots[b]
          if (one === undefined || two === undefined) continue
          const gap = Math.hypot(one.x - two.x, one.y - two.y)
          expect(gap, `${formation} ${a}/${b}`).toBeGreaterThanOrEqual(2 * SLOT_RADIUS)
        }
      }
    }
  })

  it('assigns lanes in encounter order, and does not group the input', () => {
    // `startersOf` hands back `lineup.starters` order, and the reducer never
    // checks that an XI is grouped by position — `setLineup` validates only that
    // it is legal. So a scrambled array has to come back scrambled, each man
    // holding his own bank's next lane.
    //
    // An implementation that grouped or sorted before assigning would return the
    // two defenders adjacent and fail here, while still passing every other test
    // in this file.
    const slots = pitchSlots(['DF', 'FW', 'DF'])

    expect(slots.map((slot) => slot.x)).toEqual([laneX(0, 2), laneX(0, 1), laneX(1, 2)])
    expect(slots[1]?.y).toBeLessThan(slots[0]?.y ?? 0)
  })
})

describe('colour stays in the stylesheet', () => {
  // `import.meta.url` is not a file URL under vite-node, so the path resolves
  // from the working directory — the dodge `badges.test.ts` documents.
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
  const css = read('packages/design-system/src/components/PitchView/PitchView.css')
  /* Comments are stripped first. This project has been bitten twice by a comment
     being scanned as the rule it describes — the hub's `nth-of-type` guard, and
     the reduced-motion note beside the figure keyframes. */
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '')

  it('keeps every colour value out of the TypeScript', () => {
    for (const path of [
      'packages/design-system/src/components/PitchView/pitch.ts',
      'packages/design-system/src/components/PitchView/PitchView.tsx',
    ]) {
      expect(read(path), path).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })

  it('declares the turf, and derives it rather than picking it', () => {
    // The badge-rim lesson: six hand-chosen neutrals looked fine and were wrong.
    const turf = /--pitch-turf:([^;]+);/.exec(rules)
    expect(turf?.[1]).toBeDefined()
    expect(turf?.[1]).toContain('var(--')
  })

  it('inks every position the markup can emit', () => {
    for (const position of POSITIONS) {
      expect(rules, position).toContain(`.pitch__slot[data-position='${position}']`)
    }
  })

  it('never hides the pitch, at any width', () => {
    // `.hub-figure` is `display: none` below 68rem because it is scenery. The
    // pitch is a control: hiding it makes the screen undrivable on a narrow
    // window. Asserted on the value, not just on the selector.
    expect(rules).not.toMatch(/\.pitch\b[^{]*\{[^}]*display:\s*none/)
  })

  it('lets the SVG letterbox itself, which is what makes the breakpoints free', () => {
    expect(rules).toMatch(/\.pitch\s*\{[^}]*block-size/)
    expect(read('packages/design-system/src/components/PitchView/PitchView.tsx')).toContain(
      'preserveAspectRatio',
    )
  })
})
