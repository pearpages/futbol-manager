export { createRng, type Rng, type RngState, shuffle } from './rng.ts'

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
  type Expansion,
  type Fixture,
  type FixtureId,
  isPlayed,
  type Ledger,
  type Score,
  type Season,
  type TeamRating,
} from './entities.ts'

export { GameError, isGameError } from './errors.ts'

export {
  type Board,
  judge,
  openingBoard,
  standingOf,
  STRIKES_ALLOWED,
  targetFor,
  type Verdict,
} from './board.ts'

export {
  annualIncome,
  canAfford,
  credit,
  debtLimit,
  EMPTY_LEDGER,
  expansionCost,
  FINANCE,
  gateReceipts,
  isSettlementDay,
  LEDGER_KEYS,
  ledgerNet,
  monthlyLines,
  occupancy,
  positionsFrom,
  prizeMoney,
  seedCapacity,
  sponsorMoney,
  tvMoney,
  wageBill,
  wagePremium,
} from './finance.ts'

export {
  CLUB_COUNT,
  FIXTURES_PER_ROUND,
  fixturesOn,
  generateFixtures,
  nextFixtureFor,
  ROUNDS_PER_HALF,
  TOTAL_ROUNDS,
} from './fixtures.ts'

export { computeTable, type TableRow } from './table.ts'

export { expectedGoals, MODEL, resolveFixture } from './resolve.ts'

export {
  type AdvanceDay,
  type BidAnswered,
  type BidMade,
  type Command,
  type DayAdvanced,
  type Event,
  type LineupChanged,
  type BoardVerdict,
  type ExpansionOpened,
  type ExpansionStarted,
  type ListPlayer,
  type MakeBid,
  type MatchPlayed,
  type OfferContract,
  type OfferReceived,
  type PlayerListed,
  reduce,
  type RespondToOffer,
  type SetLineup,
  type SetTactics,
  type SetTicketPrice,
  type Shortlist,
  type StartExpansion,
  type TicketPriceSet,
  type StartNewSeason,
  type TacticsChanged,
  type TermsRejected,
  type TransferCompleted,
  type ReduceResult,
  type SeasonEnded,
  type SeasonStarted,
  type WithdrawBid,
} from './reduce.ts'

export {
  acceptableYears,
  ANSWER_DAYS,
  answerBid,
  type Bid,
  type BidAnswer,
  type BidId,
  bidIsLive,
  type BidStatus,
  MAX_CONTRACT_YEARS,
  MIN_CONTRACT_YEARS,
  OFFER_LIFETIME_DAYS,
  offerTerms,
  scheduleAnswer,
  suggestedTerms,
  type Terms,
  type TermsVerdict,
} from './bids.ts'

export {
  ageOn,
  type Attributes,
  type Contract,
  contractExpiry,
  contractMonthsLeft,
  ATTRIBUTE_KEYS,
  clampRating,
  overall,
  type Player,
  type PlayerId,
  type Position,
  POSITION_WEIGHTS,
  POSITIONS,
} from './player.ts'

export {
  BALANCED,
  bestXI,
  type Formation,
  FORMATION_NAMES,
  FORMATIONS,
  keepsLineup,
  type Lineup,
  playerAttack,
  playerDefence,
  startersOf,
  type Tactics,
  teamRating,
  worstXI,
} from './lineup.ts'

export {
  generateLeagueSquads,
  generateSquad,
  generateYouthPlayer,
  SQUAD_SIZE,
  type SquadOptions,
} from './squad.ts'

export { askingPrice, expectedWage, formatMoney, valuePlayer } from './valuation.ts'

export {
  applyTransfers,
  isTransferWindowOpen,
  listedForSale,
  MAX_SQUAD,
  MIN_SQUAD,
  needFor,
  runTransferWindow,
  surplus,
  totalBudget,
  type Transfer,
  type TransferWindowOptions,
} from './market.ts'

// `contractExpiry` moved to `player.ts` at M4b — it describes a contract, and
// leaving it here closed a cycle once the rollover started asking the market who
// was still wanted. Exported above, alongside `Contract`.
export { rolloverSeason, type RolloverOptions } from './season.ts'

export {
  clubIds,
  currentDate,
  fixtures,
  type GameState,
  isSeasonComplete,
  squadOf,
} from './state.ts'

export {
  DEFAULT_FORMATION,
  defaultSeasonStart,
  newSeason,
  simulateCareer,
  type NewSeasonOptions,
  type SeasonRun,
  simulateSeason,
  simulateSeasons,
} from './simulate.ts'
