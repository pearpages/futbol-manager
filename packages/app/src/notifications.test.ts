import { describe, expect, it } from 'vitest'
import { createRng, type Event, newSeason, type PlayerId } from '@fm/domain'
import { DEFAULT_CLUBS, PLAYER_NAMES } from '@fm/data'
import { countNotable, describe as describeEvent, lookupFor, noticesFrom } from './notifications.ts'

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

const names = lookupFor(game)
const somebody = (game.squads[MID] ?? [])[0]
if (somebody === undefined) throw new Error('no squad')

describe('what is worth reporting', () => {
  it('says nothing about the clock', () => {
    // `DayAdvanced` fires on every single tick. A feed carrying it is a feed
    // nobody reads.
    const event: Event = { type: 'DayAdvanced', date: game.season.currentDate }
    expect(describeEvent(event, game, names)).toBeNull()
  })

  it('says nothing about your own clicks', () => {
    for (const event of [
      { type: 'LineupChanged', clubId: MID },
      { type: 'TacticsChanged', clubId: MID },
    ] as Event[]) {
      expect(describeEvent(event, game, names)).toBeNull()
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

    expect(describeEvent(event, game, names)).toBeNull()
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

  it('counts only what would be shown', () => {
    expect(countNotable(batch, game)).toBe(1)
  })

  it('drops the silent ones when building the list', () => {
    const notices = noticesFrom(batch, game)
    expect(notices).toHaveLength(1)
    expect(notices[0]?.text).toContain(somebody.name)
  })

  it('falls back rather than throwing on an unknown player', () => {
    const notice = describeEvent(
      { type: 'BidMade', bidId: 'b1', playerId: 'ghost' as PlayerId, fee: 100 } as Event,
      game,
      names,
    )
    expect(notice?.text).toContain('a player')
  })
})
