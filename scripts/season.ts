/**
 * Headless season runner — M1's exit criterion.
 *
 *   pnpm season [seed]
 *
 * Simulates one full 38-round season and prints the final table. Deterministic:
 * the same seed always produces the same table.
 *
 * Imports reach into package sources by relative path rather than through
 * `@fm/domain`. Node strips types natively, but skips files resolved inside
 * `node_modules` — which is where pnpm's workspace symlinks live. Relative paths
 * sidestep that without adding a runtime dependency.
 */
import {
  computeTable,
  createRng,
  formatDate,
  newSeason,
  simulateSeason,
} from '../packages/domain/src/index.ts'
import { DEFAULT_CLUBS } from '../packages/data/src/clubs.ts'
import { PLAYER_NAMES } from '../packages/data/src/names.ts'
import { DEFAULT_ROSTERS } from '../packages/data/src/rosters.ts'

const seed = Number(process.argv[2] ?? 20260813)
if (!Number.isFinite(seed)) {
  console.error(`Not a seed: ${process.argv[2]}`)
  process.exit(1)
}

const start = newSeason(DEFAULT_CLUBS, 2026, {
  names: PLAYER_NAMES,
  rosters: DEFAULT_ROSTERS,
  rng: createRng(seed),
})
const final = simulateSeason(start, createRng(seed))
const table = computeTable(final.competition.clubIds, final.season.fixtures)

const nameOf = new Map(DEFAULT_CLUBS.map((c) => [c.id, c.name]))
const pad = (value: string | number, width: number) => String(value).padStart(width)
const padEnd = (value: string, width: number) => value.padEnd(width)

console.log(
  `\nPrimera División ${final.season.startYear}/${String(final.season.startYear + 1).slice(2)}`,
)
console.log(`Seed ${seed} · season ends ${formatDate(final.season.currentDate)}\n`)
console.log(
  `    ${padEnd('Club', 22)} ${pad('P', 3)} ${pad('W', 3)} ${pad('D', 3)} ${pad('L', 3)} ${pad('GF', 4)} ${pad('GA', 4)} ${pad('GD', 4)} ${pad('Pts', 4)}`,
)
console.log(
  `    ${'-'.repeat(22)} ${'-'.repeat(3)} ${'-'.repeat(3)} ${'-'.repeat(3)} ${'-'.repeat(3)} ${'-'.repeat(4)} ${'-'.repeat(4)} ${'-'.repeat(4)} ${'-'.repeat(4)}`,
)

table.forEach((row, index) => {
  const position = index + 1
  // Champion, then relegation places — the two things a manager looks for first.
  const marker = position === 1 ? '*' : position > table.length - 3 ? 'v' : ' '
  const gd = row.goalDifference > 0 ? `+${row.goalDifference}` : String(row.goalDifference)

  console.log(
    `${pad(position, 2)}${marker} ${padEnd(nameOf.get(row.clubId) ?? row.clubId, 22)} ${pad(row.played, 3)} ${pad(row.won, 3)} ${pad(row.drawn, 3)} ${pad(row.lost, 3)} ${pad(row.goalsFor, 4)} ${pad(row.goalsAgainst, 4)} ${pad(gd, 4)} ${pad(row.points, 4)}`,
  )
})

const goals = final.season.fixtures.reduce(
  (sum, f) => sum + (f.result?.home ?? 0) + (f.result?.away ?? 0),
  0,
)
const homeWins = final.season.fixtures.filter(
  (f) => (f.result?.home ?? 0) > (f.result?.away ?? 0),
).length

console.log(
  `\n    380 played · ${goals} goals (${(goals / 380).toFixed(2)}/game) · home wins ${((homeWins / 380) * 100).toFixed(1)}%\n`,
)
