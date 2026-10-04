import { beforeEach, describe, expect, it } from 'vitest'
import { offerTerms, suggestedTerms } from './bids.ts'
import type { ClubId } from './entities.ts'
import { isTransferWindowOpen, surplus } from './market.ts'
import {
  CONTRACT_WARNING_DAYS,
  contractExpiry,
  expiresThisSeason,
  type Player,
  type PlayerId,
} from './player.ts'
import { type Command, type Event, reduce } from './reduce.ts'
import { createRng, type Rng } from './rng.ts'
import { newSeason, simulateSeason } from './simulate.ts'
import { type GameState, isSeasonComplete } from './state.ts'
import { TEST_CLUBS, TEST_NAMES } from './test-clubs.ts'
import { addDays, toCivil } from './time.ts'

/**
 * Renewing a contract, and the two announcements around it.
 *
 * Until this existed a deal running out was a number on a screen and nothing
 * else: the rollover judged your own players by the AI's retain rule and released
 * them with no event at all, so a man was simply gone from the list the next time
 * you looked. The help text said so out loud — "you do not pick which" — while
 * also advising you to "renew early", which you could not do.
 */

// Ninth of twenty, and a club that attracts a buyer in the summer window — which
// only six of the twenty do, so `who left over the summer` below is vacuous
// anywhere else. Re-pick it rather than loosening that arm if it ever stops
// selling; `market.human.test.ts` carries the full note on why the set moves.
const MID = TEST_CLUBS[8]?.id ?? ('c09' as ClubId)

let state: GameState
let rng: Rng

function dispatch(command: Command): readonly Event[] {
  const result = reduce(state, command, rng)
  state = result.state
  return result.events
}

const squad = () => state.squads[state.managedClubId] ?? []
const find = (id: PlayerId) => squad().find((p) => p.id === id)

/** Put a player on a deal that runs out at the end of the current season. */
function expireThisSeason(player: Player): Player {
  const until = contractExpiry(state.season.startYear + 1)
  const updated = { ...player, contract: { ...player.contract, until } }
  state = {
    ...state,
    squads: {
      ...state.squads,
      [state.managedClubId]: squad().map((p) => (p.id === player.id ? updated : p)),
    },
  }
  return updated
}

beforeEach(() => {
  rng = createRng(4242)
  state = newSeason(TEST_CLUBS, 2026, { names: TEST_NAMES, rng, managedClubId: MID })
})

describe('knowing a deal is up', () => {
  it('calls a contract expiring when it runs to the end of this season', () => {
    const player = squad()[0]
    if (player === undefined) throw new Error('empty squad')

    const now = { ...player, contract: { ...player.contract, until: contractExpiry(2027) } }
    const later = { ...player, contract: { ...player.contract, until: contractExpiry(2028) } }

    expect(expiresThisSeason(now, 2026)).toBe(true)
    expect(expiresThisSeason(later, 2026)).toBe(false)
  })

  it('treats a deal already run out as expiring rather than as safe', () => {
    // No live career should hold one — the rollover renews or releases everybody
    // whose months have gone negative. The `<=` is what stops a state that somehow
    // arrives that way reading as a contract with years left on it.
    const player = squad()[0]
    if (player === undefined) throw new Error('empty squad')

    const past = { ...player, contract: { ...player.contract, until: contractExpiry(2025) } }
    expect(expiresThisSeason(past, 2026)).toBe(true)
  })
})

describe('renewing', () => {
  it('writes the new terms and says so', () => {
    const player = expireThisSeason(squad()[0] as Player)
    const terms = suggestedTerms(player, state.season.currentDate)

    const events = dispatch({
      type: 'RenewContract',
      playerId: player.id,
      wage: terms.wage,
      years: 3,
    })

    expect(events).toContainEqual({
      type: 'ContractRenewed',
      playerId: player.id,
      wage: terms.wage,
      years: 3,
    })
    expect(find(player.id)?.contract).toEqual({
      until: contractExpiry(state.season.startYear + 3),
      wage: terms.wage,
    })
    // And he is no longer flagged, which is the whole point of doing it.
    expect(expiresThisSeason(find(player.id) as Player, state.season.startYear)).toBe(false)
  })

  it('works with the transfer window shut', () => {
    // The clause most likely to be "corrected" back into line with `OfferContract`
    // by someone tidying up. A deadline protects the club you would be buying from;
    // renewing your own player involves nobody else, and the rollover judges his
    // deal whether or not a window is open.
    while (isTransferWindowOpen(state.season.currentDate)) dispatch({ type: 'AdvanceDay' })

    const player = expireThisSeason(squad()[0] as Player)
    const terms = suggestedTerms(player, state.season.currentDate)

    expect(() =>
      dispatch({ type: 'RenewContract', playerId: player.id, wage: terms.wage, years: 3 }),
    ).not.toThrow()
    expect(find(player.id)?.contract.until).toBe(contractExpiry(state.season.startYear + 3))
  })

  it('refuses an offer shorter than the deal he is already on', () => {
    // With renewal available at any moment this is the one slip worth guarding:
    // one year offered to a man contracted to 2031 would quietly cut four off him.
    const player = squad().find(
      (p) => toCivil(p.contract.until).y >= state.season.startYear + 3,
    ) as Player
    expect(player).toBeDefined()

    expect(() =>
      dispatch({ type: 'RenewContract', playerId: player.id, wage: 99_999, years: 1 }),
    ).toThrow(/already contracted/i)
    expect(find(player.id)?.contract).toEqual(player.contract)
  })

  it('refuses somebody else’s player', () => {
    const other = TEST_CLUBS.find((c) => c.id !== state.managedClubId)?.id ?? ('c01' as ClubId)
    const theirs = state.squads[other]?.[0]
    if (theirs === undefined) throw new Error('no rival squad')

    expect(() =>
      dispatch({ type: 'RenewContract', playerId: theirs.id, wage: 99_999, years: 3 }),
    ).toThrow(/not one of yours/i)
  })

  it('lets him refuse a wage, as an outcome rather than a throw', () => {
    const player = expireThisSeason(squad()[0] as Player)
    const before = find(player.id)?.contract

    const events = dispatch({
      type: 'RenewContract',
      playerId: player.id,
      wage: 1,
      years: 3,
    })

    const rejection = events.find((event) => event.type === 'TermsRejected')
    expect(rejection).toBeDefined()
    expect(rejection).toMatchObject({ playerId: player.id, reason: 'wage' })
    // Nothing moved, so the terms can simply be improved and offered again.
    expect(find(player.id)?.contract).toEqual(before)
    expect(events.some((event) => event.type === 'ContractRenewed')).toBe(false)
  })

  it('lets him refuse a length he will not sign', () => {
    // The squad is aged by generation, so which players are over 32 is not stable.
    // Build the case rather than hunt for it: a 35-year-old will sign two years and
    // no more, so five is a refusal on length whatever the wage.
    const first = squad()[0] as Player
    const born = addDays(state.season.currentDate, -Math.round(35 * 365.25))
    const veteran = expireThisSeason({ ...first, birthDate: born })
    state = {
      ...state,
      squads: {
        ...state.squads,
        [state.managedClubId]: squad().map((p) => (p.id === veteran.id ? veteran : p)),
      },
    }

    const date = state.season.currentDate
    // A guard on the guard: if this ever stops being a length refusal the test
    // below would pass on a wage refusal instead and prove nothing.
    expect(offerTerms(veteran, { wage: 99_999, years: 5 }, date).reason).toBe('length')

    const events = dispatch({ type: 'RenewContract', playerId: veteran.id, wage: 99_999, years: 5 })
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'TermsRejected', reason: 'length' }),
    )
  })

  it('refuses a fractional or out-of-range length', () => {
    const player = expireThisSeason(squad()[0] as Player)

    expect(() =>
      dispatch({ type: 'RenewContract', playerId: player.id, wage: 99_999, years: 2.5 }),
    ).toThrow(/whole number/i)
    expect(() =>
      dispatch({ type: 'RenewContract', playerId: player.id, wage: 99_999, years: 9 }),
    ).toThrow(/1–5 years/i)
  })
})

describe('the warning', () => {
  it('names an expiring deal exactly once in a season', () => {
    const player = expireThisSeason(squad()[0] as Player)

    let warnings = 0
    while (!isSeasonComplete(state)) {
      const events = dispatch({ type: 'AdvanceDay' })
      warnings += events.filter(
        (event) => event.type === 'ContractExpiring' && event.playerId === player.id,
      ).length
    }

    expect(warnings).toBe(1)
  })

  it('fires half a year before the deal ends, not on a calendar date', () => {
    // Counted back from `until`, which is why it cannot land in July — the month
    // the day clock never enters, and the source of three separate defects here.
    const player = expireThisSeason(squad()[0] as Player)
    const due = addDays(player.contract.until, -CONTRACT_WARNING_DAYS)

    while (state.season.currentDate < due) {
      const events = dispatch({ type: 'AdvanceDay' })
      const warned = events.some(
        (event) => event.type === 'ContractExpiring' && event.playerId === player.id,
      )
      expect(warned).toBe(state.season.currentDate === due)
    }

    expect(toCivil(due).m).not.toBe(7)
  })

  it('says nothing about a deal with years left on it', () => {
    const safe = squad().find((p) => toCivil(p.contract.until).y > state.season.startYear + 1)
    if (safe === undefined) throw new Error('everyone is expiring')

    let warnings = 0
    while (!isSeasonComplete(state)) {
      warnings += dispatch({ type: 'AdvanceDay' }).filter(
        (event) => event.type === 'ContractExpiring' && event.playerId === safe.id,
      ).length
    }

    expect(warnings).toBe(0)
  })
})

describe('who left over the summer', () => {
  /**
   * Play the season out and roll it over, having first guaranteed both fates.
   *
   * Neither happens on its own in this seeded career: nobody in the squad is old
   * enough to retire, and the AI cannot buy a player you have not listed. Both
   * arms were written without this and both passed while asserting nothing — the
   * loops simply had no events to walk.
   */
  function rollover(options: { readonly retire: boolean }): {
    events: readonly Event[]
    before: readonly Player[]
    veteran: Player | null
  } {
    // Staged *after* the season is played and immediately before the rollover, so
    // nothing in between prunes the transfer list or ages anybody past the point
    // being set up.
    state = simulateSeason(state, rng)

    // Certain to retire: `retirementChance` is 1 from 39.
    //
    // Staged only when the test needs it, because a retirement draws rng and
    // generates a replacement — which shifts the whole stream and changes what the
    // summer window does. One helper cannot do both jobs at once.
    const first = squad()[0] as Player
    const veteran = options.retire
      ? { ...first, birthDate: addDays(state.season.currentDate, -Math.round(41 * 365.25)) }
      : null
    // Everyone sparable, not one man: only a minority of clubs attract a buyer in
    // any window, and the deals that exist are the cheap ones at the bottom — so
    // listing a single hand-picked player reliably sells nobody, which is exactly
    // how the ordering arm below first passed while asserting nothing.
    const spares = surplus(squad()).filter((p) => p.id !== veteran?.id)
    expect(spares.length).toBeGreaterThan(0)

    state = {
      ...state,
      squads: {
        ...state.squads,
        [state.managedClubId]: squad().map((p) =>
          veteran !== null && p.id === veteran.id ? veteran : p,
        ),
      },
      transferList: spares.map((p) => p.id),
    }

    const before = squad()
    return { events: dispatch({ type: 'StartNewSeason', names: TEST_NAMES }), before, veteran }
  }

  it('names everyone who is gone, and nobody who stayed', () => {
    const { events, before } = rollover({ retire: true })

    const reported = new Set(
      events
        .filter((event) => event.type === 'PlayerReleased' || event.type === 'PlayerRetired')
        .map((event) => event.playerId),
    )
    // `flatMap` rather than filter-then-map: a compound predicate does not narrow
    // the union for the `.map` that follows it, so `event.playerId` would not
    // typecheck even though every element is a `TransferCompleted`.
    const sold = new Set(
      events.flatMap((event) =>
        event.type === 'TransferCompleted' && event.from === state.managedClubId
          ? [event.playerId]
          : [],
      ),
    )
    const kept = new Set(squad().map((p) => p.id))
    const gone = before.filter((p) => !kept.has(p.id) && !sold.has(p.id)).map((p) => p.id)

    expect(gone.length).toBeGreaterThan(0)
    expect([...reported].sort()).toEqual([...gone].sort())
  })

  it('tells a release from a retirement by where he ended up', () => {
    const { events, veteran } = rollover({ retire: true })
    const free = new Set(state.freeAgents.map((p) => p.id))

    const retired = events.filter((event) => event.type === 'PlayerRetired')
    const released = events.filter((event) => event.type === 'PlayerReleased')
    // The staged 41-year-old is what makes this arm non-vacuous.
    expect(retired.map((event) => event.playerId)).toContain(veteran?.id)
    expect(released.length).toBeGreaterThan(0)

    for (const event of retired) expect(free.has(event.playerId)).toBe(false)
    for (const event of released) expect(free.has(event.playerId)).toBe(true)
  })

  it('carries the name, because a retired player cannot be looked up', () => {
    // He is gone from every squad and from the free-agent pool, so `lookupFor` in
    // the app has nothing to resolve him against. An id alone would render as
    // "unknown player" in the one sentence that exists to say who he was.
    const { events, before, veteran } = rollover({ retire: true })
    const names = new Map(before.map((p) => [p.id, p.name]))

    const departures = events.filter(
      (event) => event.type === 'PlayerReleased' || event.type === 'PlayerRetired',
    )
    expect(departures.length).toBeGreaterThan(0)
    expect(departures.some((event) => event.playerId === veteran?.id)).toBe(true)

    for (const event of departures) {
      if (event.type !== 'PlayerReleased' && event.type !== 'PlayerRetired') continue
      expect(event.name).toBe(names.get(event.playerId))
      expect(event.name).not.toBe('')
    }
  })

  it('does not report a player the summer window sold as having been released', () => {
    // The ordering trap. `StartNewSeason` rolls over *and* runs the AI window —
    // which excludes your club as a buyer but **not** as a seller — so a diff taken
    // after the window counts anyone it bought from you as released, reported twice
    // and once wrongly, with a `TransferCompleted` sitting beside it.
    const { events } = rollover({ retire: false })

    const departed = new Set(
      events
        .filter((event) => event.type === 'PlayerReleased' || event.type === 'PlayerRetired')
        .map((event) => event.playerId),
    )
    const sold = events.flatMap((event) =>
      event.type === 'TransferCompleted' && event.from === state.managedClubId
        ? [event.playerId]
        : [],
    )

    // Without a sale this asserts nothing at all, which is how it first passed.
    expect(sold.length).toBeGreaterThan(0)
    for (const id of sold) expect(departed.has(id)).toBe(false)
  })
})
