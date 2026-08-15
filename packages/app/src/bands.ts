/**
 * Qualification bands — how a Spanish classification is actually read.
 *
 * Stated as a table rather than an `if` chain, because as a chain it was wrong:
 * fifth place fell through every branch and rendered with no colour at all. A
 * list of ranges can be read against a real table at a glance, and the test walks
 * all twenty positions against it.
 *
 * `from`/`to` count from the top; negative numbers count from the bottom, so the
 * relegation zone does not need the league size hardcoded.
 *
 * This lives in the UI rather than `domain` on purpose. Which positions qualify
 * for what is arguably a competition rule and M5's prize money will want it — but
 * there is one hardcoded league today, and ground rule 5 says wait for the second
 * case. Move it when M7 brings real continental competitions.
 *
 * It sits here rather than in `TableScreen.tsx` because the hub's position stat is
 * the second caller, and a screen importing from another screen is what that would
 * otherwise mean — the same graduation `shuffle` made from `market.ts` to `rng.ts`.
 */
export interface Band {
  readonly className: string
  readonly label: string
  readonly from: number
  readonly to: number
}

export const BANDS: readonly Band[] = [
  { className: 'is-champion', label: 'table.band.champion', from: 1, to: 1 },
  { className: 'is-ucl', label: 'table.band.ucl', from: 2, to: 4 },
  { className: 'is-uel', label: 'table.band.uel', from: 5, to: 5 },
  { className: 'is-uecl', label: 'table.band.uecl', from: 6, to: 6 },
  { className: 'is-relegation', label: 'table.band.relegation', from: -3, to: -1 },
]

export function bandFor(position: number, total: number): Band | null {
  const fromBottom = position - total - 1 // 20th of 20 → −1
  return (
    BANDS.find(
      (band) =>
        (band.from > 0 && position >= band.from && position <= band.to) ||
        (band.from < 0 && fromBottom >= band.from && fromBottom <= band.to),
    ) ?? null
  )
}
