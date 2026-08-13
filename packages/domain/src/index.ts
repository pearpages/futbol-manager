export { createRng, type Rng, type RngState } from './rng.ts'

export {
  addDays,
  type CivilDate,
  type DayNumber,
  daysBetween,
  dayOfWeek,
  formatDate,
  fromCivil,
  toCivil,
} from './time.ts'

export {
  type Club,
  type ClubId,
  clubRating,
  type Competition,
  type Fixture,
  type FixtureId,
  isPlayed,
  type Score,
  type Season,
  type TeamRating,
} from './entities.ts'

export {
  CLUB_COUNT,
  FIXTURES_PER_ROUND,
  fixturesOn,
  generateFixtures,
  ROUNDS_PER_HALF,
  TOTAL_ROUNDS,
} from './fixtures.ts'

export { computeTable, type TableRow } from './table.ts'

export { expectedGoals, MODEL, resolveFixture } from './resolve.ts'

export {
  type AdvanceDay,
  type Command,
  type DayAdvanced,
  type Event,
  type MatchPlayed,
  reduce,
  type ReduceResult,
  type SeasonEnded,
} from './reduce.ts'

export { clubIds, currentDate, fixtures, type GameState, isSeasonComplete } from './state.ts'

export {
  defaultSeasonStart,
  newSeason,
  type SeasonRun,
  simulateSeason,
  simulateSeasons,
} from './simulate.ts'
