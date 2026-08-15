/**
 * Sorting a data table, for every screen that has one.
 *
 * Graduated from `MarketScreen`, which was the project's first sortable table and
 * said in its own stylesheet that the second one would move it. The classification,
 * the squad and the club picker are that second case — three of them at once, which
 * is rather more than ground rule 5 waits for.
 *
 * **`null` is the source order**, and what that means is the screen's own business:
 * the market's seeded shuffle, the classification's league order, the squad's
 * position-then-overall. The cycle always ends back there. Without a way back, one
 * click would cost you the default for the rest of the session — and on the market
 * that default is the shuffle that stops scouting being a lookup.
 *
 * A screen supplies one `value` accessor rather than a comparator, so direction and
 * collation are decided once here instead of four times. That is deliberate: the
 * accessor returns the **domain's** value, never the rendered label. Sorting a
 * translated chip alphabetically puts Catalan `POR/DEF/MIG/DAV` in a different order
 * from English `GK/DF/MF/FW`, which would make the same squad read differently in
 * each language.
 */

export interface Sort<K extends string = string> {
  readonly key: K
  readonly desc: boolean
}

/**
 * The next setting for a column, cycling descending → ascending → source order.
 *
 * Descending first because every question worth asking of these tables is a
 * superlative — who earns the most, who has conceded fewest, who is dearest.
 */
export function nextSort<K extends string>(current: Sort<K> | null, key: K): Sort<K> | null {
  if (current === null || current.key !== key) return { key, desc: true }
  return current.desc ? { key, desc: false } : null
}

/**
 * The rows in sort order — or a copy of them, when nothing is sorted.
 *
 * **Always copies.** `.sort()` mutates in place, and the market got away with sorting
 * its own array only because that array was fresh out of a `.filter()` chain. The
 * squad screen would be sorting the game's own squad array and the club picker a
 * module-level `readonly Club[]` shared with the rest of the app.
 *
 * Numbers subtract; anything else goes through `localeCompare`, because Catalan
 * collation is genuinely its own and the accented club names are exactly where an
 * ASCII comparison diverges from what is on screen.
 */
export function sortedBy<T, K extends string>(
  rows: readonly T[],
  sort: Sort<K> | null,
  value: (row: T, key: K) => number | string,
  locale: string,
): T[] {
  if (sort === null) return [...rows]

  const direction = sort.desc ? -1 : 1
  return [...rows].sort((a, b) => {
    const left = value(a, sort.key)
    const right = value(b, sort.key)
    const by =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), locale)
    return by * direction
  })
}
