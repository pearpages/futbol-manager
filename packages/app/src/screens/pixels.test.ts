import { describe, expect, it } from 'vitest'
import { gridSize, scanRuns } from './pixels.ts'
import { decodeSprite } from './sprites.ts'

/**
 * The shared grid scan.
 *
 * The case-sensitivity test is the one that matters, and it lives here now rather
 * than in `sprites.test.ts`, because the scan does — but it is stated in *both*
 * vocabularies below, since the property is only interesting for what it protects
 * in the sprites.
 */

describe('scanRuns', () => {
  it('merges a run of identical characters into one rect', () => {
    expect(scanRuns(['aaa'])).toEqual([{ char: 'a', x: 0, y: 0, w: 3 }])
  })

  it('breaks a run where the character changes', () => {
    expect(scanRuns(['aab'])).toEqual([
      { char: 'a', x: 0, y: 0, w: 2 },
      { char: 'b', x: 2, y: 0, w: 1 },
    ])
  })

  it('never merges across rows', () => {
    // A run is one pixel tall by definition — the rects are `height={1}`.
    expect(scanRuns(['aa', 'aa'])).toEqual([
      { char: 'a', x: 0, y: 0, w: 2 },
      { char: 'a', x: 0, y: 1, w: 2 },
    ])
  })

  it('is case-sensitive, so `a` never merges with `A`', () => {
    // The property `sprites.ts` rests its part split on. Fold case here and a
    // prop pixel silently rejoins the body beside it — see the sprite arm below.
    expect(scanRuns(['aaAA'])).toEqual([
      { char: 'a', x: 0, y: 0, w: 2 },
      { char: 'A', x: 2, y: 0, w: 2 },
    ])
  })

  it('emits runs in reading order', () => {
    // So a caller that groups them keeps a stable order without sorting, which is
    // what lets both decoders skip a sort entirely.
    expect(scanRuns(['ab', 'cd']).map((run) => run.char)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('scans every character, meaning included or not', () => {
    // Deciding what a character *means* is the caller's vocabulary. This one only
    // reads shape, which is why two decoders can share it.
    expect(scanRuns(['..a']).map((run) => run.char)).toEqual(['.', 'a'])
  })

  it('has nothing to say about an empty grid', () => {
    expect(scanRuns([])).toEqual([])
    expect(scanRuns([''])).toEqual([])
  })
})

describe('gridSize', () => {
  it('takes the width from the first row', () => {
    expect(gridSize(['abcd', 'abcd'])).toEqual({ width: 4, height: 2 })
  })

  it('is zero by zero for no rows', () => {
    expect(gridSize([])).toEqual({ width: 0, height: 0 })
  })
})

describe('what the case rule protects in a sprite', () => {
  it('keeps a prop pixel out of the body run beside it', () => {
    // Stated here as well as in `scanRuns`, because this is the consequence: the
    // hub slides a clipboard without dragging a necktie along with it, and only a
    // synthetic grid can show it — no real grid in this codebase puts a prop pixel
    // horizontally adjacent to a body pixel of the same ink.
    const { parts } = decodeSprite(['aaAA'])
    expect(parts.map(({ part, inks }) => [part, inks.map(({ runs }) => runs)])).toEqual([
      ['body', [[{ x: 0, y: 0, w: 2 }]]],
      ['prop', [[{ x: 2, y: 0, w: 2 }]]],
    ])
  })
})
