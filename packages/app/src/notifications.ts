import {
  type Event,
  formatMoney,
  type GameState,
  type Player,
  type PlayerId,
  type ClubId,
} from '@fm/domain'

/**
 * Turning events into something a manager can read.
 *
 * Every command already emits events, and the store already keeps them — but
 * until now only `MatchPlayed` was ever rendered, on the table screen. A bid
 * answered three days after you made it, an offer for one of your players, a
 * transfer completing: all of it happened silently. This is the missing half.
 *
 * Kept as a pure function rather than built inside a component so it can be
 * tested without rendering, the same way `bandFor` and `listingsFor` are.
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

export function lookupFor(game: GameState): NameLookup {
  const players = new Map<PlayerId, Player>()
  for (const club of game.clubs) {
    for (const player of game.squads[club.id] ?? []) players.set(player.id, player)
  }
  for (const player of game.freeAgents) players.set(player.id, player)

  const clubs = new Map(game.clubs.map((club) => [club.id, club]))

  return {
    player: (id) => players.get(id)?.name ?? 'a player',
    // `null` is the free-agent pool, which belongs to nobody.
    club: (id) => (id === null ? 'free agents' : (clubs.get(id)?.name ?? 'another club')),
  }
}

/**
 * One event as one line, or `null` when it is not worth interrupting for.
 *
 * The silent ones are deliberate. `DayAdvanced` fires every single tick,
 * `LineupChanged` and `TacticsChanged` fire because *you* just did that — a feed
 * that reports your own clicks back to you is noise, and noise is what makes a
 * player stop reading the thing.
 */
export function describe(event: Event, game: GameState, names: NameLookup): Notice | null {
  const you = game.managedClubId
  const day = game.season.currentDate

  switch (event.type) {
    case 'DayAdvanced':
    case 'LineupChanged':
    case 'TacticsChanged':
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
      const tone: NoticeTone = ours > theirs ? 'good' : ours < theirs ? 'bad' : 'plain'
      const verb = ours > theirs ? 'Beat' : ours < theirs ? 'Lost to' : 'Drew with'
      return {
        key: `${event.fixtureId}`,
        text: `${verb} ${opponent} ${ours}–${theirs}`,
        tone,
      }
    }

    case 'BidMade':
      return {
        key: `bid-${event.bidId}-${day}`,
        text: `Bid ${formatMoney(event.fee)} for ${names.player(event.playerId)}`,
        tone: 'plain',
      }

    case 'BidAnswered': {
      const who = names.player(event.playerId)
      const key = `answer-${event.bidId}-${event.status}-${day}`
      if (event.status === 'accepted') {
        return { key, text: `Fee agreed for ${who} — now agree terms`, tone: 'good' }
      }
      if (event.status === 'countered') {
        return {
          key,
          text: `Counter-offer for ${who}: they want ${formatMoney(event.counterFee ?? 0)}`,
          tone: 'plain',
        }
      }
      if (event.status === 'rejected') {
        return { key, text: `Your bid for ${who} was rejected`, tone: 'bad' }
      }
      return null // withdrawn — you did that yourself
    }

    case 'OfferReceived':
      return {
        key: `offer-${event.bidId}-${day}`,
        text: `${names.club(event.from)} offer ${formatMoney(event.fee)} for ${names.player(event.playerId)}`,
        tone: 'plain',
      }

    case 'TermsRejected': {
      const reason =
        event.reason === 'wage'
          ? `he wants ${formatMoney(event.wanted)} a season`
          : 'he will not sign for that long'
      return {
        key: `terms-${event.playerId}-${day}`,
        text: `${names.player(event.playerId)} refused your terms — ${reason}`,
        tone: 'bad',
      }
    }

    case 'TransferCompleted': {
      const who = names.player(event.playerId)
      const fee = event.fee === 0 ? 'on a free' : `for ${formatMoney(event.fee)}`
      if (event.to === you) {
        return { key: `in-${event.playerId}-${day}`, text: `Signed ${who} ${fee}`, tone: 'good' }
      }
      if (event.from === you) {
        return {
          key: `out-${event.playerId}-${day}`,
          text: `Sold ${who} to ${names.club(event.to)} ${fee}`,
          tone: 'plain',
        }
      }
      // Someone else's business. Worth knowing only when it is the club you are
      // chasing a player from, and we cannot tell — so stay quiet.
      return null
    }

    case 'PlayerListed':
      return {
        key: `listed-${event.playerId}-${event.on}-${day}`,
        text: event.on
          ? `${names.player(event.playerId)} is up for sale`
          : `${names.player(event.playerId)} is off the market`,
        tone: 'plain',
      }

    case 'SeasonEnded':
      return { key: `end-${event.startYear}`, text: `The season is over`, tone: 'plain' }

    case 'SeasonStarted':
      return {
        key: `start-${event.startYear}`,
        text: `${event.startYear}/${String(event.startYear + 1).slice(2)} begins`,
        tone: 'plain',
      }

    case 'TicketPriceSet':
      // Your own hand on the slider, reported back at you. Same reason
      // `TacticsChanged` is silent.
      return null

    case 'BoardVerdict': {
      const key = `board-${event.startYear}`
      if (event.dismissed) {
        return {
          key,
          text: `The board have dismissed you. ${ordinal(event.finish)} against a target of ${ordinal(event.target)}.`,
          tone: 'bad',
        }
      }
      if (!event.met) {
        return {
          key,
          text: `The board wanted ${ordinal(event.target)} and you finished ${ordinal(event.finish)}. They expect better.`,
          tone: 'bad',
        }
      }
      return {
        key,
        text: `${ordinal(event.finish)}, against a target of ${ordinal(event.target)}. The board are satisfied.`,
        tone: 'good',
      }
    }

    case 'ExpansionStarted':
      return {
        key: `build-${event.readyYear}`,
        text: `Work begins on ${event.seats.toLocaleString('en')} new seats — ${formatMoney(event.cost)}, ready for ${String(event.readyYear)}/${String(event.readyYear + 1).slice(2)}`,
        tone: 'plain',
      }

    case 'ExpansionOpened':
      return {
        key: `built-${event.capacity}`,
        text: `The new stand is open — ${event.capacity.toLocaleString('en')} seats`,
        tone: 'good',
      }
  }
}

/** `12` → `12º`. Spanish, like the rest of the chrome. */
function ordinal(position: number): string {
  return `${String(position)}º`
}

/** Every notice worth showing, newest first — the order the feed is already in. */
export function noticesFrom(feed: readonly Event[], game: GameState): Notice[] {
  const names = lookupFor(game)
  const notices: Notice[] = []
  for (const event of feed) {
    const notice = describe(event, game, names)
    if (notice !== null) notices.push(notice)
  }
  return notices
}

/** How many of a batch of events would actually be shown — the unread count. */
export function countNotable(events: readonly Event[], game: GameState): number {
  const names = lookupFor(game)
  return events.reduce((n, event) => n + (describe(event, game, names) === null ? 0 : 1), 0)
}
