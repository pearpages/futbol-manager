import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { labelAt, nodeAt, polygonPoints, RADAR_RINGS, ringPoints, spokes } from './radar.ts'

/**
 * The radar's geometry, checked without rendering anything.
 *
 * A chart that is subtly wrong — an axis running the wrong way, a value plotted
 * against the wrong scale — looks perfectly plausible. These assert the parts a
 * screenshot could not tell you were broken.
 */

const CENTRE = 60
const pairs = (points: string) =>
  points.split(' ').map((pair) => {
    const [x, y] = pair.split(',').map(Number)
    return { x: x ?? 0, y: y ?? 0 }
  })

describe('polygonPoints', () => {
  it('plots one vertex per attribute', () => {
    expect(pairs(polygonPoints([1, 2, 3, 4, 5, 6, 7, 8]))).toHaveLength(8)
  })

  it('puts the first axis straight up from the centre', () => {
    const [first] = pairs(polygonPoints([100, 0, 0, 0, 0, 0, 0, 0]))
    expect(first?.x).toBeCloseTo(CENTRE, 6)
    expect(first?.y).toBeLessThan(CENTRE)
  })

  it('scales a zero to the centre and a hundred to the outer ring', () => {
    const centred = pairs(polygonPoints(Array<number>(8).fill(0)))
    for (const point of centred) {
      expect(point.x).toBeCloseTo(CENTRE, 6)
      expect(point.y).toBeCloseTo(CENTRE, 6)
    }
    expect(polygonPoints(Array<number>(8).fill(100))).toBe(ringPoints(1))
  })

  it('runs clockwise', () => {
    // Index 2 is a quarter turn on from the top, so it is the rightmost axis, and
    // index 6 the leftmost. Anticlockwise would swap them and nothing else would
    // look wrong.
    const points = pairs(polygonPoints(Array<number>(8).fill(100)))
    const xs = points.map((p) => p.x)
    expect(xs.indexOf(Math.max(...xs))).toBe(2)
    expect(xs.indexOf(Math.min(...xs))).toBe(6)
  })
})

describe('the grid', () => {
  it('draws a ring per step, each inside the next', () => {
    const widths = RADAR_RINGS.map((f) => {
      const xs = pairs(ringPoints(f)).map((p) => p.x)
      return Math.max(...xs) - Math.min(...xs)
    })
    expect(widths).toHaveLength(4)
    expect([...widths].sort((a, b) => a - b)).toEqual(widths)
  })

  it('runs every spoke from the centre outward', () => {
    const drawn = spokes()
    expect(drawn).toHaveLength(8)
    for (const spoke of drawn) {
      expect(spoke.x1).toBe(CENTRE)
      expect(spoke.y1).toBe(CENTRE)
      // Coordinates are rounded to 2dp so the markup stays readable, which is
      // worth a hundredth of a pixel on the radius.
      expect(Math.hypot(spoke.x2 - CENTRE, spoke.y2 - CENTRE)).toBeCloseTo(40, 1)
    }
  })
})

describe('labelAt', () => {
  it('anchors text away from the chart on each side', () => {
    // Left-hand labels have to grow leftwards or they overlap the rings.
    expect(labelAt(0).anchor).toBe('middle')
    expect(labelAt(4).anchor).toBe('middle')
    for (const index of [1, 2, 3]) expect(labelAt(index).anchor, `${index}`).toBe('start')
    for (const index of [5, 6, 7]) expect(labelAt(index).anchor, `${index}`).toBe('end')
  })

  it('sits outside the outer ring', () => {
    for (let i = 0; i < 8; i++) {
      const { x, y } = labelAt(i)
      expect(Math.hypot(x - CENTRE, y - CENTRE)).toBeGreaterThan(40)
    }
  })
})

describe('nodeAt', () => {
  it('lands on the polygon it decorates', () => {
    const values = [80, 12, 45, 99, 3, 61, 27, 50]
    const vertices = pairs(polygonPoints(values))
    values.forEach((value, i) => {
      const node = nodeAt(value, i)
      expect(node.x).toBeCloseTo(vertices[i]?.x ?? 0, 6)
      expect(node.y).toBeCloseTo(vertices[i]?.y ?? 0, 6)
    })
  })
})

describe('colour stays in the stylesheet', () => {
  // Relative to this file, so the test runs the same from the repo root and from
  // the package.
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

  it('declares both series as tokens, and draws with them', () => {
    // The pair is shared with the attribute rows beside the chart, which are not
    // inside it — so it is a token rather than a property on `.radar`.
    const tokens = read('../../tokens.css')
    expect(tokens).toContain('--fm-series-a:')
    expect(tokens).toContain('--fm-series-b:')

    const css = read('./AttributeRadar.css')
    expect(css).toContain('var(--fm-series-a)')
    expect(css).toContain('var(--fm-series-b)')
  })

  it('keeps every colour value out of the TypeScript', () => {
    // The split that makes the chart themeable at all: geometry here, colour there.
    for (const path of ['./radar.ts', './AttributeRadar.tsx']) {
      expect(read(path), path).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })
})
