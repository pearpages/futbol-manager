import { describe, expect, it } from 'vitest'
import { createRng, type Event, newSeason, type PlayerId } from '@fm/domain'
import { DEFAULT_CLUBS, PLAYER_NAMES } from '@fm/data'
import { translatorFor } from './i18n/useT.ts'
import { describe as describeEvent, isNotable, lookupFor, noticesFrom } from './notifications.ts'

/**
 * The event-to-sentence layer, tested without rendering — the same pattern
 * `bandFor` and `listingsFor` follow.
 */

const MID = DEFAULT_CLUBS[13]?.id
if (MID === undefined) throw new Error('no clubs')

const game = newSeason(DEFAULT_CLUBS, 2026, {
  names: PLAYER_NAMES,
  rng: createRng(7),
  managedClubId: MID,
})

// Tested in English: these assert on wording, and pinning a language is what
// makes that possible without the test becoming a second copy of a dictionary.
const t = translatorFor('en')
const names = lookupFor(game, t)
const somebody = (game.squads[MID] ?? [])[0]
if (somebody === undefined) throw new Error('no squad')

describe('what is worth reporting', () => {
  it('says nothing about the clock', () => {
    // `DayAdvanced` fires on every single tick. A feed carrying it is a feed
    // nobody reads.
    const event: Event = { type: 'DayAdvanced', date: game.season.currentDate }
    expect(describeEvent(event, game, names, t)).toBeNull()
  })

  it('says nothing about your own clicks', () => {
    for (const event of [
      { type: 'LineupChanged', clubId: MID },
      { type: 'TacticsChanged', clubId: MID },
    ] as Event[]) {
      expect(describeEvent(event, game, names, t)).toBeNull()
    }
  })

  it('ignores other clubs’ results', () => {
    // Nineteen a week would bury everything else, and the table already has them.
    const other = DEFAULT_CLUBS[0]?.id
    const another = DEFAULT_CLUBS[1]?.id
    if (other === undefined || another === undefined) throw new Error('no clubs')

    const event = {
      type: 'MatchPlayed',
      fixtureId: 'x',
      round: 1,
      homeId: other,
      awayId: another,
      score: { home: 1, away: 0 },
    } as unknown as Event

    expect(describeEvent(event, game, names, t)).toBeNull()
  })
})

describe('how it reads', () => {
  const result = (home: number, away: number) =>
    describeEvent(
      {
        type: 'MatchPlayed',
        fixtureId: 'f1',
        round: 1,
        homeId: MID,
        awayId: DEFAULT_CLUBS[0]?.id,
        score: { home, away },
      } as unknown as Event,
      game,
      names,
      t,
    )

  it('tells a win from a defeat, in words and in tone', () => {
    expect(result(2, 0)?.text).toMatch(/^Beat /)
    expect(result(2, 0)?.tone).toBe('good')
    expect(result(0, 2)?.text).toMatch(/^Lost to /)
    expect(result(0, 2)?.tone).toBe('bad')
    expect(result(1, 1)?.text).toMatch(/^Drew with /)
    expect(result(1, 1)?.tone).toBe('plain')
  })

  it('names the player and the money on a bid answer', () => {
    const notice = describeEvent(
      {
        type: 'BidAnswered',
        bidId: 'b1',
        playerId: somebody.id,
        status: 'countered',
        counterFee: 4200,
      } as unknown as Event,
      game,
      names,
      t,
    )

    expect(notice?.text).toContain(somebody.name)
    expect(notice?.text).toContain('€4.2M')
  })

  it('turns an accepted fee into the next thing to do', () => {
    const notice = describeEvent(
      {
        type: 'BidAnswered',
        bidId: 'b1',
        playerId: somebody.id,
        status: 'accepted',
        counterFee: null,
      } as unknown as Event,
      game,
      names,
      t,
    )
    expect(notice?.text).toMatch(/agree terms/)
    expect(notice?.tone).toBe('good')
  })

  it('says why terms were refused', () => {
    const notice = describeEvent(
      {
        type: 'TermsRejected',
        playerId: somebody.id,
        reason: 'wage',
        wanted: 1100,
      } as unknown as Event,
      game,
      names,
      t,
    )
    expect(notice?.text).toContain('€1.1M')
    expect(notice?.tone).toBe('bad')
  })

  it('distinguishes a signing from a sale', () => {
    const incoming = describeEvent(
      {
        type: 'TransferCompleted',
        playerId: somebody.id,
        from: DEFAULT_CLUBS[0]?.id,
        to: MID,
        fee: 0,
      } as unknown as Event,
      game,
      names,
      t,
    )
    expect(incoming?.text).toMatch(/^Signed .* on a free$/)

    const outgoing = describeEvent(
      {
        type: 'TransferCompleted',
        playerId: somebody.id,
        from: MID,
        to: DEFAULT_CLUBS[0]?.id,
        fee: 900,
      } as unknown as Event,
      game,
      names,
      t,
    )
    expect(outgoing?.text).toMatch(/^Sold /)
    expect(outgoing?.text).toContain('€900k')
  })

  it('stays quiet about business between two other clubs', () => {
    const between = describeEvent(
      {
        type: 'TransferCompleted',
        playerId: somebody.id,
        from: DEFAULT_CLUBS[0]?.id,
        to: DEFAULT_CLUBS[1]?.id,
        fee: 900,
      } as unknown as Event,
      game,
      names,
      t,
    )
    expect(between).toBeNull()
  })
})

describe('counting and collecting', () => {
  const batch = [
    { type: 'DayAdvanced', date: game.season.currentDate },
    { type: 'LineupChanged', clubId: MID },
    { type: 'BidMade', bidId: 'b1', playerId: somebody.id, fee: 500 },
  ] as unknown as Event[]

  it('drops the silent ones when building the list', () => {
    const notices = noticesFrom(batch, game, t)
    expect(notices).toHaveLength(1)
    expect(notices[0]?.text).toContain(somebody.name)
  })

  it('falls back rather than throwing on an unknown player', () => {
    const notice = describeEvent(
      { type: 'BidMade', bidId: 'b1', playerId: 'ghost' as PlayerId, fee: 100 } as Event,
      game,
      names,
      t,
    )
    expect(notice?.text).toContain('a player')
  })
})

describe('the transfer window', () => {
  const change = (open: boolean): Event =>
    ({ type: 'TransferWindowChanged', open, date: game.season.currentDate }) as Event

  it('says which way it turned, as a whole sentence either way', () => {
    expect(describeEvent(change(true), game, names, t)?.text).toBe('The transfer window is open.')
    expect(describeEvent(change(false), game, names, t)?.text).toBe(
      'The transfer window has closed.',
    )
  })

  it('warns with the count, so the threshold can move without the wording lying', () => {
    const closing = (daysLeft: number): Event =>
      ({ type: 'TransferWindowClosing', daysLeft, date: game.season.currentDate }) as Event

    expect(describeEvent(closing(7), game, names, t)?.text).toBe(
      '7 days of the transfer window left.',
    )
    // Singular, not "1 days" — the reason this is a plural key and not a parameter.
    expect(describeEvent(closing(1), game, names, t)?.text).toBe(
      '1 day of the transfer window left.',
    )
  })

  it('keys the two apart, so a rollover cannot swallow one', () => {
    // The rollover can emit an opening on the same date a season's last tick
    // reports a closing, and the feed keys on the pair.
    const opened = describeEvent(change(true), game, names, t)
    const closed = describeEvent(change(false), game, names, t)
    expect(opened?.key).not.toBe(closed?.key)
    expect(noticesFrom([change(true), change(false)], game, t)).toHaveLength(2)
  })
})

describe('isNotable agrees with describe', () => {
  /**
   * The drift guard.
   *
   * `isNotable` exists because the unread count is kept in the store, which has
   * no translator and cannot get one without closing an import cycle. That makes
   * it a second copy of `describe`'s silent set, and a second copy is only safe
   * while something checks it.
   *
   * One of every event type, including both sides of each conditional — a
   * predicate keyed on `type` alone would pass a list of distinct types and still
   * be wrong about the other club's match, the withdrawn bid and the transfer
   * between two clubs, which are exactly the three cases that are conditional.
   */
  const OTHER = DEFAULT_CLUBS[0]?.id
  if (OTHER === undefined || OTHER === MID) throw new Error('need a second club')

  const cases: readonly Event[] = [
    { type: 'DayAdvanced', date: game.season.currentDate },
    { type: 'LineupChanged', clubId: MID },
    { type: 'TacticsChanged', clubId: MID },
    { type: 'TicketPriceSet', clubId: MID, price: 0.01 },
    { type: 'SeasonEnded', startYear: 2026 },
    { type: 'SeasonStarted', startYear: 2027 },
    {
      type: 'MatchPlayed',
      fixtureId: 'f1',
      homeId: MID,
      awayId: OTHER,
      score: { home: 1, away: 0 },
    },
    {
      type: 'MatchPlayed',
      fixtureId: 'f2',
      homeId: OTHER,
      awayId: OTHER,
      score: { home: 1, away: 0 },
    },
    { type: 'BidMade', bidId: 'b1', playerId: somebody.id, fee: 500 },
    { type: 'BidAnswered', bidId: 'b1', playerId: somebody.id, status: 'accepted' },
    { type: 'BidAnswered', bidId: 'b1', playerId: somebody.id, status: 'rejected' },
    {
      type: 'BidAnswered',
      bidId: 'b1',
      playerId: somebody.id,
      status: 'countered',
      counterFee: 900,
    },
    { type: 'BidAnswered', bidId: 'b1', playerId: somebody.id, status: 'withdrawn' },
    { type: 'OfferReceived', bidId: 'b2', playerId: somebody.id, from: OTHER, fee: 400 },
    { type: 'TermsRejected', playerId: somebody.id },
    { type: 'ContractRenewed', playerId: somebody.id, wage: 400, years: 3 },
    { type: 'ContractExpiring', playerId: somebody.id },
    { type: 'PlayerReleased', playerId: somebody.id, name: somebody.name },
    { type: 'PlayerRetired', playerId: somebody.id, name: somebody.name, age: 36 },
    { type: 'PlayerListed', playerId: somebody.id, on: true },
    { type: 'TransferCompleted', playerId: somebody.id, from: OTHER, to: MID, fee: 100 },
    { type: 'TransferCompleted', playerId: somebody.id, from: MID, to: OTHER, fee: 100 },
    { type: 'TransferCompleted', playerId: somebody.id, from: OTHER, to: OTHER, fee: 100 },
    { type: 'BoardVerdict', met: true, target: 10, finished: 8, sacked: false, warned: false },
    { type: 'ExpansionStarted', clubId: MID, seats: 2000, readyYear: 2028 },
    { type: 'ExpansionOpened', clubId: MID, seats: 2000 },
    { type: 'TransferWindowChanged', open: true, date: game.season.currentDate },
    { type: 'TransferWindowClosing', daysLeft: 7, date: game.season.currentDate },
  ] as unknown as Event[]

  it('answers the same for every event type, on both sides of each condition', () => {
    for (const event of cases) {
      expect({ type: event.type, notable: isNotable(event, MID) }).toEqual({
        type: event.type,
        notable: describeEvent(event, game, names, t) !== null,
      })
    }
  })

  it('covers every member of the Event union', () => {
    // A guard on the guard: the list above is hand-written, so a new event type
    // would otherwise be checked by nothing at all and default to notable.
    const covered = new Set(cases.map((event) => event.type))
    expect([...covered].sort()).toEqual(
      [
        'BidAnswered',
        'BidMade',
        'BoardVerdict',
        'ContractExpiring',
        'ContractRenewed',
        'DayAdvanced',
        'ExpansionOpened',
        'ExpansionStarted',
        'LineupChanged',
        'MatchPlayed',
        'OfferReceived',
        'PlayerListed',
        'PlayerReleased',
        'PlayerRetired',
        'SeasonEnded',
        'SeasonStarted',
        'TacticsChanged',
        'TermsRejected',
        'TicketPriceSet',
        'TransferCompleted',
        'TransferWindowChanged',
        'TransferWindowClosing',
      ].sort(),
    )
  })
})

describe('a feed from another build', () => {
  it('says nothing about an event type it does not recognise, rather than crashing', () => {
    // The feed is saved now, and it rides in the envelope where nothing migrates
    // it — so a save can hand back an event type this build has no case for.
    // `describe`'s switch is exhaustive over the union at *compile* time, so an
    // unknown type at runtime falls off the end and returns `undefined`. Checking
    // only `!== null` would push that into the list and crash on `.text`.
    const stranger = { type: 'AnEventFromTheFuture', wat: true } as unknown as Event

    expect(describeEvent(stranger, game, names, t)).toBeUndefined()
    expect(noticesFrom([stranger], game, t)).toEqual([])
  })

  it('still reports the events beside it', () => {
    // Guard on the guard: skipping the stranger must not skip the rest of the
    // feed, which a `return []` on the first oddity would.
    const stranger = { type: 'AnEventFromTheFuture' } as unknown as Event
    const real = { type: 'BidMade', bidId: 'b1', playerId: somebody.id, fee: 500 } as Event

    const notices = noticesFrom([stranger, real, stranger], game, t)
    expect(notices).toHaveLength(1)
    expect(notices[0]?.text).toContain(somebody.name)
  })
})

describe('the article in front of a club, in Catalan', () => {
  /**
   * The one thing a unit test of `clubPhrase` cannot show: that the call sites
   * actually reach it. Catalan elides in front of a vowel, so Elche is the club
   * that tells a working sentence from a broken one — `contra el Elche` was what
   * every one of these read before.
   */
  const ca = translatorFor('ca')
  const caNames = lookupFor(game, ca)
  const vowel = DEFAULT_CLUBS.find((c) => c.name === 'Elche')
  const consonant = DEFAULT_CLUBS.find((c) => c.name === 'Madrid')
  if (vowel === undefined || consonant === undefined) throw new Error('no such club')

  const played = (awayId: string) =>
    describeEvent(
      {
        type: 'MatchPlayed',
        fixtureId: 'f1',
        homeId: MID,
        awayId,
        score: { home: 2, away: 0 },
      } as unknown as Event,
      game,
      caNames,
      ca,
    )

  it('elides for a club that starts with a vowel', () => {
    expect(played(vowel.id)?.text).toBe('Victòria contra l’Elche 2–0')
  })

  it('and still writes the plain article for one that does not', () => {
    // Guard on the guard: eliding everything would satisfy the case above.
    expect(played(consonant.id)?.text).toBe('Victòria contra el Madrid 2–0')
  })

  it('contracts the preposition on a sale', () => {
    const sale = (to: string) =>
      describeEvent(
        {
          type: 'TransferCompleted',
          playerId: somebody.id,
          from: MID,
          to,
          fee: 900,
        } as unknown as Event,
        game,
        caNames,
        ca,
      )

    expect(sale(vowel.id)?.text).toContain('venut a l’Elche')
    expect(sale(consonant.id)?.text).toContain('venut al Madrid')
  })

  it('leaves a club it cannot resolve to its own wording', () => {
    // `un altre club` brings its own determiner, so it must never go through
    // `clubPhrase` — `el un altre club` is what that would read.
    expect(caNames.clubPhrase('nobody' as never)).toBe(ca.t('news.unknownClub'))
    expect(caNames.clubPhrase(null)).toBe(ca.t('news.freeAgents'))
  })
})
