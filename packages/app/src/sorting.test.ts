import { describe, expect, it } from 'vitest'
import { nextSort, type Sort, sortedBy } from './sorting.ts'

/**
 * The sorting primitive, without rendering anything.
 *
 * The same split the screens use: what can be answered by the function is answered
 * here, and only the things that need a DOM are driven through `<App />`.
 */

describe('the sort cycle', () => {
  it('goes descending, then ascending, then back to the source order', () => {
    // The third state is the one that matters. Without a way back, one click would
    // cost you the default for the session — on the market, the shuffle that stops
    // scouting being a lookup.
    const first = nextSort(null, 'wage')
    expect(first).toEqual({ key: 'wage', desc: true })

    const second = nextSort(first, 'wage')
    expect(second).toEqual({ key: 'wage', desc: false })

    expect(nextSort(second, 'wage')).toBeNull()
  })

  it('starts a different column fresh, descending', () => {
    // Every question these tables are asked is a superlative, so the first press
    // should answer "who is the most", not "who is the least".
    const ascendingOnWage: Sort = { key: 'wage', desc: false }
    expect(nextSort(ascendingOnWage, 'age')).toEqual({ key: 'age', desc: true })
  })
})

describe('sorting rows', () => {
  const rows = [{ n: 2 }, { n: 3 }, { n: 1 }]
  const byN = (row: { n: number }) => row.n

  it('never mutates the array it is given', () => {
    // `.sort()` sorts in place. The market got away with it because its array was
    // fresh out of a `.filter()` chain; the squad screen hands over the game's own
    // squad and the club picker a module-level `DEFAULT_CLUBS` shared app-wide.
    const original = [...rows]
    sortedBy(rows, { key: 'n', desc: true }, byN, 'en')
    expect(rows).toEqual(original)
  })

  it('copies even when nothing is sorted, so a caller cannot sort it later', () => {
    const out = sortedBy(rows, null, byN, 'en')
    expect(out).toEqual(rows)
    expect(out).not.toBe(rows)
  })

  it('orders numbers as numbers, not as text', () => {
    // The trap a naive `String(...)` comparison falls into: 10 sorts before 9.
    const many = [{ n: 9 }, { n: 10 }, { n: 1 }]
    expect(sortedBy(many, { key: 'n', desc: false }, byN, 'en').map(byN)).toEqual([1, 9, 10])
  })

  it('compares text through the locale, which is why the locale is threaded in', () => {
    // Catalan collation is genuinely its own, and the accented club names are
    // exactly where an ASCII comparison diverges from what is on the screen.
    const names = [{ name: 'Sarrià' }, { name: 'Almería' }, { name: 'A Coruña' }]
    const sorted = sortedBy(names, { key: 'name', desc: false }, (r) => r.name, 'ca')
    expect(sorted.map((r) => r.name)).toEqual(['A Coruña', 'Almería', 'Sarrià'])
  })
})
