import type { ClubId, Event, GameState, Player, PlayerId } from '@fm/domain'
import type { Translator } from './i18n/useT.ts'

/**
 * Turning events into something a manager can read.
 *
 * Every command emits events and the store keeps them; this is what makes them
 * sentences. Kept as a pure function rather than built inside a component so it
 * can be tested without rendering, the same way `bandFor` and `listingsFor` are.
 *
 * **Every sentence is whole.** The English version used to pick a verb — `Beat`,
 * `Lost to`, `Drew with` — and glue it in front of the opponent and the score.
 * That works in English and nowhere else: Catalan and Spanish put the result
 * first and the club after a preposition that agrees with it. So each outcome is
 * its own key, and nothing here concatenates translated fragments.
 */

export type NoticeTone = 'good' | 'bad' | 'plain'

export interface Notice {
  /** Stable enough to key a list: two identical events on one day are one notice. */
  readonly key: string
  readonly text: string
  readonly tone: NoticeTone
}

/** Names resolved once per render pass rather than per event. */
export interface NameLookup {
  player(id: PlayerId): string
  club(id: ClubId | null): string
}

export function lookupFor(game: GameState, { t }: Translator): NameLookup {
  const players = new Map<PlayerId, Player>()
  for (const club of game.clubs) {
    for (const player of game.squads[club.id] ?? []) players.set(player.id, player)
  }
  for (const player of game.freeAgents) players.set(player.id, player)

  const clubs = new Map(game.clubs.map((club) => [club.id, club]))

  return {
    player: (id) => players.get(id)?.name ?? t('news.unknownPlayer'),
    // `null` is the free-agent pool, which belongs to nobody.
    club: (id) =>
      id === null ? t('news.freeAgents') : (clubs.get(id)?.name ?? t('news.unknownClub')),
  }
}

/**
 * One event as one line, or `null` when it is not worth interrupting for.
 *
 * The silent ones are deliberate. `DayAdvanced` fires every single tick, and
 * `LineupChanged`, `TacticsChanged` and `TicketPriceSet` fire because *you* just
 * did that — a feed that reports your own clicks back to you is noise, and noise
 * is what makes a player stop reading the thing.
 */
export function describe(
  event: Event,
  game: GameState,
  names: NameLookup,
  translator: Translator,
): Notice | null {
  const { t, plural, money, count, season } = translator
  const you = game.managedClubId
  const day = game.season.currentDate

  switch (event.type) {
    case 'DayAdvanced':
    case 'LineupChanged':
    case 'TacticsChanged':
    case 'TicketPriceSet':
      return null

    case 'MatchPlayed': {
      // Only yours. Nineteen other results a week would bury everything else,
      // and the table screen already lists them all.
      if (event.homeId !== you && event.awayId !== you) return null
      const home = event.homeId === you
      const opponent = names.club(home ? event.awayId : event.homeId)
      const [ours, theirs] = home
        ? [event.score.home, event.score.away]
        : [event.score.away, event.score.home]

      const key = ours > theirs ? 'news.won' : ours < theirs ? 'news.lost' : 'news.drew'
      const tone: NoticeTone = ours > theirs ? 'good' : ours < theirs ? 'bad' : 'plain'
      return { key: `${event.fixtureId}`, text: t(key, { opponent, ours, theirs }), tone }
    }

    case 'BidMade':
      return {
        key: `bid-${event.bidId}-${day}`,
        text: t('news.bidMade', { fee: money(event.fee), player: names.player(event.playerId) }),
        tone: 'plain',
      }

    case 'BidAnswered': {
      const player = names.player(event.playerId)
      const key = `answer-${event.bidId}-${event.status}-${day}`
      if (event.status === 'accepted') {
        return { key, text: t('news.bidAccepted', { player }), tone: 'good' }
      }
      if (event.status === 'countered') {
        return {
          key,
          text: t('news.bidCountered', { player, fee: money(event.counterFee ?? 0) }),
          tone: 'plain',
        }
      }
      if (event.status === 'rejected') {
        return { key, text: t('news.bidRejected', { player }), tone: 'bad' }
      }
      return null // withdrawn — you did that yourself
    }

    case 'OfferReceived':
      return {
        key: `offer-${event.bidId}-${day}`,
        text: t('news.offerReceived', {
          club: names.club(event.from),
          fee: money(event.fee),
          player: names.player(event.playerId),
        }),
        tone: 'plain',
      }

    case 'TermsRejected':
      return {
        key: `terms-${event.playerId}-${day}`,
        text: t(event.reason === 'wage' ? 'news.termsRejectedWage' : 'news.termsRejectedLength', {
          player: names.player(event.playerId),
          wage: money(event.wanted),
        }),
        tone: 'bad',
      }

    case 'TransferCompleted': {
      const player = names.player(event.playerId)
      const free = event.fee === 0
      if (event.to === you) {
        return {
          key: `in-${event.playerId}-${day}`,
          text: t(free ? 'news.signedFree' : 'news.signed', { player, fee: money(event.fee) }),
          tone: 'good',
        }
      }
      if (event.from === you) {
        return {
          key: `out-${event.playerId}-${day}`,
          text: t(free ? 'news.soldFree' : 'news.sold', {
            player,
            club: names.club(event.to),
            fee: money(event.fee),
          }),
          tone: 'plain',
        }
      }
      // Someone else's business. Worth knowing only when it is the club you are
      // chasing a player from, and we cannot tell — so stay quiet.
      return null
    }

    case 'ContractRenewed':
      // Your own click, and yet not silent like `TacticsChanged`. A tactic is a
      // setting you can see on the screen you set it from; a renewal is a
      // multi-year commitment made in a dialog that closes behind you.
      return {
        key: `renewed-${event.playerId}-${day}`,
        text: t('news.contractRenewed', {
          player: names.player(event.playerId),
          years: count(event.years),
          wage: money(event.wage),
        }),
        tone: 'good',
      }

    case 'ContractExpiring':
      return {
        key: `expiring-${event.playerId}-${day}`,
        text: t('news.contractExpiring', { player: names.player(event.playerId) }),
        tone: 'bad',
      }

    case 'PlayerReleased':
      // The name comes off the event rather than the lookup. He is in the
      // free-agent pool so `names.player` would in fact still find him, but the
      // retirement beside this one cannot be looked up at all, and one moment
      // should not resolve its subject two different ways.
      return {
        key: `released-${event.playerId}-${day}`,
        text: t('news.playerReleased', { player: event.name }),
        tone: 'bad',
      }

    case 'PlayerRetired':
      return {
        key: `retired-${event.playerId}-${day}`,
        text: t('news.playerRetired', { player: event.name, age: count(event.age) }),
        tone: 'plain',
      }

    case 'PlayerListed':
      return {
        key: `listed-${event.playerId}-${String(event.on)}-${day}`,
        text: t(event.on ? 'news.listed' : 'news.unlisted', {
          player: names.player(event.playerId),
        }),
        tone: 'plain',
      }

    case 'SeasonEnded':
      return { key: `end-${event.startYear}`, text: t('news.seasonEnded'), tone: 'plain' }

    case 'SeasonStarted':
      return {
        key: `start-${event.startYear}`,
        text: t('news.seasonStarted', { season: season(event.startYear) }),
        tone: 'plain',
      }

    case 'BoardVerdict': {
      const key = `board-${event.startYear}`
      const params = { finish: event.finish, target: event.target }
      if (event.dismissed) return { key, text: t('news.boardSacked', params), tone: 'bad' }
      if (!event.met) return { key, text: t('news.boardWarned', params), tone: 'bad' }
      return { key, text: t('news.boardHappy', params), tone: 'good' }
    }

    case 'ExpansionStarted':
      return {
        key: `build-${event.readyYear}`,
        text: plural('news.expansionStarted', event.seats, {
          seats: count(event.seats),
          cost: money(event.cost),
          season: season(event.readyYear),
        }),
        tone: 'plain',
      }

    case 'ExpansionOpened':
      return {
        key: `built-${event.capacity}`,
        text: t('news.expansionOpened', { capacity: count(event.capacity) }),
        tone: 'good',
      }

    // The opening is the invitation and the closing is the deadline, so both are
    // worth a line. Two whole sentences rather than one with the state glued in.
    case 'TransferWindowChanged':
      return {
        key: `window-${event.open ? 'open' : 'shut'}-${String(event.date)}`,
        text: t(event.open ? 'news.windowOpened' : 'news.windowClosed'),
        tone: 'plain',
      }

    case 'TransferWindowClosing':
      return {
        key: `window-closing-${String(event.date)}`,
        text: plural('news.windowClosing', event.daysLeft),
        tone: 'plain',
      }
  }
}

/**
 * Whether {@link describe} would say anything about this event.
 *
 * Exists because the unread count is kept in the store, and the store has no
 * translator — `describe` needs one, and reaching for `useT` from there would
 * close an import cycle. Counting raw events instead is not an option:
 * `DayAdvanced` fires on every single tick, so the badge would never be zero.
 *
 * **This must agree with `describe` exactly**, and it is duplicated logic, so
 * `notifications.test.ts` drives one of every event type through both and
 * asserts they answer the same. Change one, change the other, and the test is
 * what will tell you if you forgot.
 */
export function isNotable(event: Event, you: ClubId): boolean {
  switch (event.type) {
    case 'DayAdvanced':
    case 'LineupChanged':
    case 'TacticsChanged':
    case 'TicketPriceSet':
      return false
    // Nineteen other results a week would bury everything else.
    case 'MatchPlayed':
      return event.homeId === you || event.awayId === you
    // Withdrawn is your own hand.
    case 'BidAnswered':
      return event.status !== 'withdrawn'
    // Two clubs trading with each other is not your business.
    case 'TransferCompleted':
      return event.to === you || event.from === you
    default:
      return true
  }
}

/**
 * Every notice worth showing, newest first — the order the feed is already in.
 *
 * **Skips anything that is not a notice, not merely `null`.** The feed is now
 * saved, and it rides in the envelope where nothing migrates it — so a save can
 * hand back an event type this build no longer has a case for. `describe`'s
 * switch has no `default`: it is exhaustive over the `Event` union at compile
 * time, which means an unrecognised type at *runtime* falls off the end and
 * returns `undefined`. Checking only `!== null` would push that undefined
 * straight into the list and crash on `.text`.
 */
export function noticesFrom(
  feed: readonly Event[],
  game: GameState,
  translator: Translator,
): Notice[] {
  const names = lookupFor(game, translator)
  const notices: Notice[] = []
  for (const event of feed) {
    const notice = describe(event, game, names, translator) as Notice | null | undefined
    if (notice != null) notices.push(notice)
  }
  return notices
}
