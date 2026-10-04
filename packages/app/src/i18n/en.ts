import type { Dictionary } from './index.ts'

/**
 * English.
 *
 * Written first and used as the reference the other two are translated against —
 * but it is not privileged: `translate` falls back to Catalan, the default, and
 * the parity test treats all three as equals.
 */
export const en: Dictionary = {
  // ── Navigation ───────────────────────────────────────────────────────────
  // One key per destination, shared by the hub tile and the title bar. They were
  // two separate literals in two files, which is how "the bar says what you
  // clicked" quietly stops being true.
  'nav.hub': 'Menu Manager',
  'nav.table': 'Classification',
  'nav.results': 'Results',
  'nav.calendar': 'Calendar',
  'nav.lineup': 'Lineup',
  'nav.training': 'Training',
  'nav.scout': 'Scout opponent',
  'nav.market': 'Sign players',
  'nav.squad': 'Squad',
  'nav.youth': 'Youth academy',
  'nav.caja': 'Accounts',
  'nav.decisiones': 'Board',
  'nav.estadio': 'Stadium',
  'nav.player': 'Player',

  'quadrant.seguimiento': 'Following',
  'quadrant.entrenador': 'Coaching',
  'quadrant.mercado': 'Transfers',
  'quadrant.finanzas': 'Finances',

  'action.back': 'Back',
  'action.save': 'Quick save',
  'action.saving': 'Saving…',
  'action.saved': 'Saved · {date}',
  'action.saves': 'Saved games',
  'action.more': 'More',
  'action.unread.one': '{count} unread',
  'action.unread.other': '{count} unread',
  'action.newCareer': 'New career',
  'action.cancel': 'Cancel',
  'action.close': 'Close',
  'action.settings': 'Settings',
  'action.language': 'Language',

  // ── The shell ────────────────────────────────────────────────────────────
  'shell.wordmark': 'Futbol Manager',
  'shell.matchday': 'Matchday {round}',
  'shell.windowOpen.one': 'Transfer window open · {count} day',
  'shell.windowOpen.other': 'Transfer window open · {count} days',
  'shell.madeBy': 'Made by',

  // ── Fixtures ─────────────────────────────────────────────────────────────
  // Home and away as whole phrases: the letter in brackets is an abbreviation of
  // a word, and the word differs.
  'fixture.home': 'v {club} (H)',
  'fixture.away': 'v {club} (A)',
  'fixture.unknownClub': '???',

  // ── The hub ──────────────────────────────────────────────────────────────
  'hub.arrivesAt': 'Arrives at {milestone}',
  'hub.date': 'Date',
  'hub.budget': 'Budget',
  'hub.position': 'Position',
  'hub.nextMatch': 'Next match',
  'hub.seasonOver': 'The season is over.',
  'hub.today': 'Today',
  'hub.inDays.one': 'in {count} day',
  'hub.inDays.other': 'in {count} days',
  'hub.dismissed':
    'The board have dismissed you. They wanted position {target} and did not get it twice running.',
  'hub.weakLineup':
    'Your XI is not your strongest — {current} against {best}. Signing someone does not pick him.',
  'hub.startSeason': 'Start {season}',
  'hub.playMatch': 'Play match {opponent}',
  'hub.toMatchday': 'To matchday',
  'hub.advanceDay': 'Advance day',
  'hub.news': 'News',
  'hub.readNews': 'See all',
  'hub.noNews': 'Nothing has happened yet.',

  // ── Saved games ──────────────────────────────────────────────────────────
  'saves.title': 'Saved games',
  // What a career that predates named saves gets called.
  'saves.adoptedName': 'My career',
  // The dialog's own button. Plain `Desar`, not `action.save` — that one is the
  // footer's quick save, and "Quick save" reads wrong on a form that names a file.
  'saves.write': 'Save',
  'saves.nameLabel': 'Name this save',
  'saves.empty': 'Nothing saved yet.',
  'saves.column.name': 'Save',
  'saves.column.career': 'Career',
  'saves.column.action': 'Action',
  'saves.summary': '{date} · {club} · matchday {round}',
  'saves.summaryOver': '{date} · {club} · season over',
  'saves.current': 'Playing',
  'saves.load': 'Load',
  'saves.delete': 'Delete',
  'saves.confirmOverwrite': 'Write over “{name}”? What it holds now is gone.',
  'saves.confirmLoad': 'Load “{name}”? Anything you have not saved in this career is lost.',
  'saves.confirmDelete': 'Delete “{name}”? There is no way back to it.',

  // ── Classification ───────────────────────────────────────────────────────
  'table.band.champion': 'Champion',
  'table.band.ucl': 'Champions League',
  'table.band.uel': 'Europa League',
  'table.band.uecl': 'Conference League',
  'table.band.relegation': 'Relegated',
  'table.qualification': 'Qualification',
  'table.column.position': '#',
  'table.column.club': 'Club',
  'table.column.played': 'P',
  'table.column.won': 'W',
  'table.column.drawn': 'D',
  'table.column.lost': 'L',
  'table.column.goalsFor': 'GF',
  'table.column.goalsAgainst': 'GA',
  'table.column.goalDifference': 'GD',
  'table.column.points': 'Pts',
  'table.matchday': 'Matchday',
  'table.date': 'Date',
  'table.latestResults': 'Latest results',
  'table.noResults': 'Advance the day to play the next round.',

  // ── Results and honours ──────────────────────────────────────────────────
  'results.tab.round': 'Matchday',
  'results.roundLabel': 'Matchday {round}',
  'results.prevRound': 'Previous matchday',
  'results.nextRound': 'Next matchday',
  'results.tab.grid': 'Results',
  'results.tab.palmares': 'Honours',
  'results.season': 'Season',
  'results.gridHeading': 'Every result · {season}',
  'results.gridNote':
    'Each row is the home club and each column the away club. A score reads home–away.',
  'results.homeAway': 'Home against away',
  'results.cell': '{home} {ours}–{theirs} {away}, matchday {round}',
  'results.unplayed': '{home} against {away}, not played yet',
  'results.noSeason': 'That season is not in the archive.',
  'results.archived.one': '{count} season archived.',
  'results.archived.other': '{count} seasons archived.',
  'palmares.yours': 'Your honours',
  'palmares.league': 'League roll of honour',
  'palmares.history': 'League history',
  'palmares.empty': 'No season has finished yet. The record starts with this one.',
  'palmares.noChampions': 'No champions yet.',
  'palmares.competition.league': 'League',
  'palmares.won.one': '{count} title',
  'palmares.won.other': '{count} titles',
  'palmares.neverWon': 'None yet',
  'palmares.best': 'Best finish: {position}',
  'palmares.noSeasons': 'No season completed',
  'palmares.seasons.one': '{count} season',
  'palmares.seasons.other': '{count} seasons',
  'palmares.column.season': 'Season',
  'palmares.column.champion': 'Champion',
  'palmares.column.runnerUp': 'Runner-up',
  'palmares.column.you': 'You',
  'form.notPlayed': 'Not played yet',

  // ── Calendar ────────────────────────────────────────────────────
  'calendar.heading': 'Calendar · {season}',
  'calendar.column.round': 'Matchday',
  'calendar.column.date': 'Date',
  'calendar.column.opponent': 'Opponent',
  'calendar.column.result': 'Result',
  'calendar.windowOpens': 'The transfer window opens',
  'calendar.windowCloses': 'The transfer window closes',
  'calendar.settlement': 'Wages, television and sponsorship',
  'calendar.seasonEnds': 'Season ends, and the board decides',
  'calendar.won': 'Won',
  'calendar.drew': 'Drew',
  'calendar.lost': 'Lost',

  // ── Squad ────────────────────────────────────────────────────────────────
  'squad.heading': '{club} · Squad',
  'squad.column.number': '#',
  'squad.column.position': 'Pos',
  'squad.column.player': 'Player',
  'squad.column.age': 'Age',
  'squad.column.overall': 'Ovr',
  'squad.column.worth': 'Worth',
  'squad.column.wage': 'Wage',
  'squad.column.contract': 'Until',
  'squad.column.selected': 'Selected',
  'squad.column.sale': 'Sale',
  'squad.starting': 'Starting XI',
  'squad.notSelected': '—',
  'squad.list': 'List',
  'squad.listed': 'Listed',
  'squad.cannotList.lineup': 'He is in your starting eleven — take him out of the XI first',
  'squad.cannotList.coverKeeper': 'You would be left with one goalkeeper',
  'squad.column.contractAction': 'Contract',
  'squad.renew': 'Renew',
  'squad.expiring': 'His contract expires this season',

  // ── Renewal ──────────────────────────────────────────────────────────────
  'renew.title': 'Renew {player}',
  'renew.current': 'He is on {wage} and under contract to {year}',
  'renew.hint':
    'A contract running out is worth nothing as a fee — he leaves for nothing instead. Renewing costs you no money today, but you are committed to the wage until it ends.',
  'renew.offer': 'Offer renewal',

  // ── Bidding for somebody else's player ───────────────────────────────────
  'player.bid': 'Make an offer',
  'bid.title': 'Bid for {player}',
  'bid.reluctant':
    '{club} picked him. They will want far more for him than he is worth on paper, and a low offer is simply turned down.',
  'bid.willing': '{club} would let him go. He is priced to sell.',

  'position.GK': 'GK',
  'position.DF': 'DF',
  'position.MF': 'MF',
  'position.FW': 'FW',

  // ── Lineup ───────────────────────────────────────────────────────────────
  'lineup.startingXI': 'Starting XI',
  'lineup.needed': '{count} needed',
  'lineup.pick': 'Replace',
  'lineup.pitch': 'The pitch',
  'lineup.bench': 'Substitutes',
  'lineup.available.one': '{count} available',
  'lineup.available.other': '{count} available',
  'lineup.replacing': 'Who comes on for {name}?',
  'lineup.noSubs': 'No substitutes at this position.',
  'lineup.slotLabel': '{position} · {name} · {overall}',
  'lineup.shape': 'Shape',
  'lineup.formation': 'Formation',
  'lineup.formationHint': 'Changing shape picks the best XI for it.',
  'lineup.cannotField': 'Your squad cannot fill this shape',
  'lineup.approach': 'Approach · {approach}',
  'lineup.approachHint':
    'Pushing either way costs more than it gives. Attack suits a strong side; a weaker one is punished for it.',
  'lineup.thisXI': 'This XI',
  'lineup.attack': 'Attack',
  'lineup.tempo': 'Tempo',
  'lineup.defence': 'Defence',
  'lineup.ratingHint': 'These three numbers are all the match resolver sees.',
  'approach.allOut': 'All-out attack',
  'approach.attacking': 'Attacking',
  'approach.balanced': 'Balanced',
  'approach.defensive': 'Defensive',
  'tempo.open': 'Open',
  'tempo.balanced': 'Balanced',
  'tempo.tight': 'Tight',
  'approach.parkTheBus': 'Park the bus',

  // ── Player ───────────────────────────────────────────────────────────────
  'player.none': 'No player selected',
  'player.pickOne': 'Pick someone from the squad list.',
  'player.overall': 'Overall',
  'player.age': 'Age',
  'player.attack': 'Attack',
  'player.defence': 'Defence',
  'player.wage': 'Wage',
  'player.contract': 'Contract to',
  'player.inXI': 'In the starting XI.',
  'player.onBench': 'On the bench. Change the lineup to start them.',
  'attribute.pace': 'Pace',
  'attribute.finishing': 'Finishing',
  'attribute.passing': 'Passing',
  'attribute.dribbling': 'Dribbling',
  'attribute.tackling': 'Tackling',
  'attribute.heading': 'Heading',
  'attribute.keeping': 'Keeping',
  'attribute.stamina': 'Stamina',
  // Short forms for the radar's axes — eight full names do not fit an octagon.
  'attribute.short.pace': 'PAC',
  'attribute.short.finishing': 'FIN',
  'attribute.short.passing': 'PAS',
  'attribute.short.dribbling': 'DRI',
  'attribute.short.tackling': 'TAC',
  'attribute.short.heading': 'HEA',
  'attribute.short.keeping': 'KEE',
  'attribute.short.stamina': 'STA',
  'player.compare': 'Compare with',
  'player.compareNone': 'Nobody',
  'player.compareOption': '{name} · {position} {overall}',
  'player.radar': 'Attribute chart for {name}',
  'player.model.heading': 'What his numbers do',
  'player.model.overall': 'Overall, as a {position}',
  'player.model.attack': 'Team attack',
  'player.model.defence': 'Team defence',
  'player.model.unused': 'Counts for nothing here: {attributes}',
  'player.model.keeperAttack': 'A goalkeeper adds nothing to the attack.',
  'player.model.keeperDefence': 'His keeping is the whole of it.',
  'player.model.share':
    'In your {formation} he would own {attack} of the team’s attack and {defence} of its defence.',
  'player.model.keeperShare':
    'In your {formation} he would carry {defence} of the team’s defence on his own — more than any other single player.',
  'player.model.result':
    'Attack against the opponent’s defence sets the goals you expect: {points} rating points of advantage is worth about {ratio} more of them.',

  // ── Market ───────────────────────────────────────────────────────────────
  'market.heading': 'Transfer market',
  'market.tab.forSale': 'For sale',
  'market.tab.clubs': 'Clubs',
  'market.allClubs': '‹ All clubs',
  'market.atHome': 'Your league',
  'country.EN': 'England',
  'country.DE': 'Germany',
  'country.FR': 'France',
  'country.IT': 'Italy',
  'country.PT': 'Portugal',
  'country.NL': 'Netherlands',
  'country.BE': 'Belgium',
  'country.TR': 'Türkiye',
  'market.squadSize': '{count} players',
  'market.windowShut': 'The window is shut. It opens in July and August, and again in January.',
  'market.withinBudget': 'Within budget',
  'market.freeAgents': 'Free agents',
  'market.shortlistOnly': 'Shortlist only',
  'market.showing': 'Showing {shown} of {total}',
  'market.page': 'Page {page} of {pages}',
  'market.prevPage': 'Previous page',
  'market.nextPage': 'Next page',
  'market.noMatches': 'Nobody matches those filters.',
  'market.column.position': 'Pos',
  'market.column.player': 'Player',
  'market.column.club': 'Club',
  'market.column.age': 'Age',
  'market.column.overall': 'Ovr',
  'market.column.asking': 'Asking',
  'market.column.wants': 'They want',
  'market.column.action': 'Act',
  'market.freeAgent': 'Free agent',
  'market.free': 'Free',
  'market.watch': 'Watch',
  'market.watching': 'Listed',
  'market.sign': 'Sign',
  'market.bid': 'Bid',
  'market.budget': 'Budget',
  'market.window': 'Window',
  'market.windowOpen': 'Open',
  'market.windowClosed': 'Shut',
  'market.upForSale': 'Up for sale',
  'market.nobodyListed':
    'Nobody listed. Your squad is invisible to other clubs until you put someone on the market — list them from the squad screen.',
  'market.askingLine': '{position} · asking {fee}',
  'market.takeOff': 'Take off',
  'market.offersForYours': 'Offers for your players',
  'market.noOffers': 'Nothing on the table.',
  'market.unknownPlayer': 'Unknown',
  'market.accept': 'Accept',
  'market.reject': 'Reject',
  'market.yourBids': 'Your bids',
  'market.noBids': 'No bids outstanding.',
  // Deliberately its own key. The window's state is also "Open" in English and
  // the two are different words elsewhere — a shared key would be a bug you only
  // see in translation.
  'market.openNegotiation': 'Open',
  'market.withdraw': 'Withdraw',
  'market.feeAgreed': 'Fee agreed — settle terms',
  'market.theyWant': 'They want {fee}',
  'market.awaiting': 'Awaiting an answer',
  'market.feeField': 'Fee (thousands) · they ask {fee}',
  'market.makeBid': 'Make bid',
  'market.bidAgain': 'Bid again',
  'market.outlay': 'Plus a {percent} signing bonus of {bonus} to the player — {total} in all.',
  'market.bidHint':
    'A bid at or above the asking price is accepted. Below it they may name their own. An answer takes a couple of days.',
  'market.wageField': 'Wage a season (thousands) · he wants {wage}',
  'market.yearsField': 'Contract length in years',
  'market.signHim': 'Sign him',
  'market.offerTerms': 'Offer terms',
  'market.termsHint': 'A fee buys the right to talk to him. He still has to want to come.',

  // ── Setup ────────────────────────────────────────────────────────────────
  'setup.heading': 'Choose a club',
  // Another tab is holding the database open at an older version.
  'setup.storageBlocked':
    'Your career could not be read: the game is open in another tab. Close it and reload this page.',
  'setup.note': 'You manage one club for the season. The rest are run by the game.',
  'setup.column.club': 'Club',
  'setup.column.attack': 'Att',
  'setup.column.defence': 'Def',
  'setup.column.prospects': 'Prospects',
  'setup.takeCharge': 'Take charge',
  'tier.contender': 'Contender',
  'tier.contender.note': 'Expected to win it. Anything less is a failure.',
  'tier.european': 'European',
  'tier.european.note': 'Should finish top six. A title needs luck.',
  'tier.midTable': 'Mid-table',
  'tier.midTable.note': 'Safe most years. Europe is a good season.',
  'tier.struggler': 'Struggler',
  'tier.struggler.note': 'Survival is the job.',
  'tier.relegation': 'Relegation favourite',
  'tier.relegation.note': 'Staying up would be an achievement.',

  // ── Finances ─────────────────────────────────────────────────────────────
  'caja.heading': 'Accounts',
  'caja.column.line': 'Item',
  'caja.column.thisSeason': 'This season',
  'caja.column.lastSeason': 'Last season',
  'caja.line.gate': 'Gate',
  'caja.line.tv': 'Television',
  'caja.line.sponsor': 'Sponsorship',
  'caja.line.prize': 'Prize money',
  'caja.line.transfers': 'Transfers',
  'caja.line.wages': 'Wages',
  'caja.line.bonuses': 'Signing bonuses',
  'caja.line.interest': 'Interest',
  'caja.line.stadium': 'Building work',
  'caja.result': 'Result',
  'caja.note':
    'Every movement of your balance is one of these lines and nothing else. The season’s books start again each August, once the prize money has landed.',
  'caja.balance': 'Balance',
  'caja.available': 'Available',
  'caja.overdraftLimit': 'Overdraft limit',
  'caja.overdraftNote':
    'Available is what you can commit — your balance plus the overdraft. You pay interest while you are in the red, and the board does not judge you on it.',
  'caja.projection': 'Forecast',
  'caja.projectionNote':
    'A whole season at today’s squad, ticket price and position {position}. Not what you have banked — the accounts say that. Transfers are your own doing, so they are left out.',
  'caja.projectionNoteEarly':
    'A whole season at today’s squad and ticket price, assuming a mid-table finish until there is a table to read. Transfers are your own doing, so they are left out.',
  'caja.wages': 'Wages',
  'caja.annual': 'Annual',
  'caja.squad': 'Squad',
  'caja.wagesNote':
    'Paid monthly. A club sitting on money pays over the odds, so a large balance costs you more than it earns.',

  // ── The board ────────────────────────────────────────────────────────────
  'board.heading': 'The objective',
  'board.fallbackName': 'The board',
  'board.demand': '{club} expect to finish in position {target} or better.',
  'board.target': 'Target',
  'board.now': 'Now',
  'board.played': 'Played',
  'board.nothingPlayed': 'Nothing has been played yet.',
  'board.onCourse': 'On course. Keep it there.',
  'board.below': 'Below what was asked for.',
  'board.patience': 'Patience',
  'board.clean':
    'Miss the target and the board will say so. Miss it {strikes} seasons running and you are gone.',
  'board.warned': 'You have been warned once. Miss it again and the board will act.',
  'board.sacked': 'The board have dismissed you.',
  'board.whatCounts': 'What counts',
  'board.whatCountsNote':
    'Only where you finish. The board does not look at your balance, your overdraft or what you charge at the gate — those are yours to run.',
  'board.targetNote':
    'The target moves with you: finish well and more is asked next season, finish badly and less is. It is the warnings that end a job, not the arithmetic.',

  // ── Stadium ──────────────────────────────────────────────────────────────
  'estadio.heading': 'The ground',
  'estadio.capacity': 'Capacity',
  'estadio.occupancy': 'Occupancy',
  'estadio.perMatch': 'Per match',
  'estadio.season': 'Season',
  'estadio.full': 'Full',
  'estadio.price': 'Price · {price} a seat',
  'estadio.priceHint':
    'Charging more takes more per head and leaves seats empty. There is a best price, and it moves with how good you are and where you sit.',
  'estadio.works': 'Building work',
  'estadio.underWay.one': '{seats} new seat is being built, ready for {season}. One job at a time.',
  'estadio.underWay.other':
    '{seats} new seats are being built, ready for {season}. One job at a time.',
  'estadio.seats': 'Seats · {cost}',
  'estadio.seatsHint':
    'Paid now, ready next season. Seats are only worth building if you are filling the ones you have.',
  'estadio.begin': 'Begin work',

  // ── News ─────────────────────────────────────────────────────────────────
  // Whole sentences, never assembled. "Beat" + opponent + score is English word
  // order and nothing else's.
  'news.won': 'Beat {opponent} {ours}–{theirs}',
  'news.lost': 'Lost to {opponent} {ours}–{theirs}',
  'news.drew': 'Drew with {opponent} {ours}–{theirs}',
  'news.bidMade': 'Bid {fee} for {player}',
  'news.bidAccepted': 'Fee agreed for {player} — now agree terms',
  'news.bidCountered': 'Counter-offer for {player}: they want {fee}',
  'news.bidRejected': 'Your bid for {player} was rejected',
  'news.offerReceived': '{club} offer {fee} for {player}',
  'news.termsRejectedWage': '{player} refused your terms — he wants {wage} a season',
  'news.termsRejectedLength': '{player} refused your terms — he will not sign for that long',
  'news.signed': 'Signed {player} for {fee}',
  'news.signedFree': 'Signed {player} on a free',
  'news.sold': 'Sold {player} to {club} for {fee}',
  'news.soldFree': 'Sold {player} to {club} on a free',
  'news.contractRenewed': '{player} has signed on for {years} more years, at {wage} a season',
  'news.contractExpiring': '{player}’s contract runs out at the end of the season',
  'news.playerReleased': '{player} leaves on a free — his contract was not renewed',
  'news.playerRetired': '{player} has retired at {age}',
  'news.listed': '{player} is up for sale',
  'news.unlisted': '{player} is off the market',
  'news.seasonEnded': 'The season is over',
  'news.seasonStarted': '{season} begins',
  'news.boardSacked':
    'The board have dismissed you. You finished in position {finish}, against a target of {target}.',
  'news.boardWarned':
    'The board wanted position {target} and you finished {finish}. They expect better.',
  'news.boardHappy':
    'Finished in position {finish}, against a target of {target}. The board are satisfied.',
  'news.expansionStarted.one': 'Work begins on {seats} new seat — {cost}, ready for {season}',
  'news.expansionStarted.other': 'Work begins on {seats} new seats — {cost}, ready for {season}',
  'news.expansionOpened': 'The new stand is open — {capacity} seats',
  'news.windowOpened': 'The transfer window is open.',
  'news.windowClosed': 'The transfer window has closed.',
  'news.windowClosing.one': '{count} day of the transfer window left.',
  'news.windowClosing.other': '{count} days of the transfer window left.',
  'news.unknownPlayer': 'a player',
  'news.freeAgents': 'free agents',
  'news.unknownClub': 'another club',

  // ── Explainers ───────────────────────────────────────────────────────────
  'explain.open': 'Explain: {topic}',
  'explain.occupancy.title': 'How full the ground gets',
  'explain.occupancy.p1':
    'A forecast, not a gate you have already taken. It is what today’s squad, today’s league position and today’s ticket price would fill, for a match played now.',
  'explain.occupancy.p2':
    'Quality does most of it and the table does the rest — climbing fills seats. A good club with the ground half empty is usually charging too much.',
  'explain.ticket.title': 'What to charge',
  'explain.ticket.p1':
    'Every seat sold pays the same price, so a dearer ticket takes more per head and leaves more seats empty. The two pull against each other and the gate is what is left.',
  'explain.ticket.p2':
    'Somewhere between them is a better price for your club, and it is dearer than the league default rather than cheaper. It is not the top of the slider, though — push that far and you lose more in empty seats than you gain per head.',
  'explain.expansion.title': 'Building work',
  'explain.expansion.p1':
    'Seats are paid for the moment you order them and arrive in time for next season. One job at a time.',
  'explain.expansion.p2':
    'An expansion runs from {min} to {max} seats, and only pays if you are filling the ground you already have. Seats nobody sits in earn nothing, and that money would have done more in the squad.',
  'explain.squadTable.title': 'Reading this table',
  'explain.squadTable.p1':
    'One number standing in for eight attributes, weighted by the position he plays. A defender’s tackling counts for far more than his finishing; for a forward it is the other way round.',
  'explain.squadTable.p2':
    'It is what this list sorts by and what a fee is calculated from, but it is not quite what wins matches. Open his card to see which attributes the match itself reads.',
  'explain.squadTable.p3':
    'Roughly what another club would ask for him: his quality first, then his age, then how much contract is left.',
  'explain.squadTable.p4':
    'The contract is the part that moves fastest. He runs down in value as his deal runs out and is worth nothing as a fee once it expires — he leaves for nothing instead. Sell early or renew early; the last few months are the expensive ones to get wrong.',
  'explain.squadTable.p5':
    'A wage is what he costs you for a whole season, paid in monthly instalments. Every wage here added together is the wage bill on your accounts.',
  'explain.squadTable.p6':
    'Until is the season his contract ends, marked in red when that season is this one. Reach the summer having done nothing and the club renews whoever it still needs while the rest walk — but you can renew him yourself first, at any point.',
  'explain.squadTable.p7':
    'Listing tells the other nineteen clubs he is available. Without it your squad is nearly invisible to them: they may still come for someone you can clearly spare, but a listed player takes far less convincing.',
  'explain.squadTable.p8':
    'Listing is the consent. A listed player who attracts a buyer is sold, and you are not asked again.',
  'explain.squadTable.p9':
    'You cannot list a man in your starting eleven — drop him first — and you cannot leave yourself with one goalkeeper. Squads run from {min} to {max}: nobody buys at the ceiling, and clubs stop selling near the floor.',
  'explain.squadTable.p10':
    'Renewing is a negotiation rather than a button: you name a wage and a length, and he can refuse both. It costs you nothing today and needs no open window. What you buy is time — and a player who is worth a fee again if you decide to sell.',
  'explain.teamRating.title': 'Attack, defence and tempo',
  'explain.teamRating.p1':
    'These three numbers are the whole of what the match sees. Not the names, not the shape — your eleven collapses into these, the opponent’s into theirs, and the goals come from the two meeting.',
  'explain.teamRating.p2':
    'Your attack is measured against their defence, and theirs against yours. A few points of advantage is worth more than it looks, because the effect multiplies rather than adds.',
  'explain.teamRating.p3':
    'Not every shirt weighs the same. A forward owns far more of the attack than a defender does, and your goalkeeper is a bigger share of the defence than any outfield player — which makes him the single upgrade that changes most.',
  'explain.tempo.title': 'Tempo, and why there is no slider for it',
  'explain.tempo.p1':
    'Tempo is how open the game is. It favours nobody: it raises or lowers the goals both sides expect, together.',
  'explain.tempo.p2':
    'You never set it directly. Your shape settles most of it and your approach adds the rest — a front-heavy side plays a fast game, five at the back a slow one.',
  'explain.tempo.p3':
    'And it is settled between the two teams rather than by you alone: yours is averaged with the opponent’s, so you only ever get half of what you chose. A slow game suits the weaker side, because fewer goals means more draws, and a draw is worth more to them than to you.',
  'explain.approach.title': 'The approach slider',
  'explain.approach.p1':
    'Sliding towards attack takes strength out of your defence and puts it into your attack; sliding the other way does the reverse. It does not make the team better.',
  'explain.approach.p2':
    'Nor is it an even trade in either direction — you always give up more than you gain, and the further you push the worse the rate. Committing to attack suits a side good enough to win the game outright; a weaker one does better shutting it down. A middling team is usually punished for doing either.',
  'explain.calendar.title': 'The dates that matter',
  'explain.calendar.p1':
    'Your thirty-eight matches in order, with the dates the league and the board impose on you set among them. Matchdays come one a week; nothing else does.',
  'explain.calendar.p2':
    'The window is only open in summer and in January. You can see when it is open in the top corner, and you get a warning {warning} days before it shuts. Once shut you can neither buy nor sell until it opens again.',
  'explain.calendar.p3':
    'On the first of every month the whole squad’s wages go out, and the television and sponsorship money comes in. All at once: a balance that looks healthy on the thirtieth can be thin on the second. Building work and transfer fees are paid separately, on the day you sign them.',
  'explain.calendar.p4':
    'The last match closes the season, and it is the same day the board judges where you finished. Then the summer begins and the market opens again.',

  // ── Refusals ─────────────────────────────────────────────────────────────
  // Keyed off the codes the reducer throws. The English here is word for word
  // what `domain` still carries as its `Error.message`, so the two cannot drift
  // without someone noticing.
  'error.unknown': 'That is not allowed',
  'error.window.closed': 'The transfer window is closed',
  'error.player.unknown': 'No such player',
  'error.player.freeAgent': 'A free agent costs no fee — offer him a contract instead',
  'error.player.yours': 'He is already yours',
  'error.player.squadFloor': "{player}'s club has too small a squad to sell anybody",
  'error.player.lastAtPosition': "{player}'s club cannot spare another player in his position",
  'error.bid.positive': 'A bid must be a positive fee',
  'error.bid.overdraft': 'That would take you past your overdraft limit',
  'error.bid.live': 'There is already a live bid for {player}',
  'error.bid.unknown': 'No such bid',
  'error.bid.notYours': 'That is not your bid',
  'error.squad.full': 'Your squad is full',
  'error.contract.noFee': 'No agreed fee for {player}',
  'error.contract.wholeYears': 'Contract length must be whole years',
  'error.contract.range': 'A contract runs {min}–{max} years',
  'error.contract.negativeWage': 'A wage cannot be negative',
  'error.renew.notYours': 'You can only renew your own players',
  'error.renew.shorter': '{player} is already contracted for longer than that',
  'error.offer.notYours': 'That offer is not yours to answer',
  'error.offer.settled': 'That offer has already been settled',
  'error.offer.cannotSpare': 'You can no longer spare him',
  'error.list.notYours': 'You can only list your own players',
  'error.list.firstTeam': '{player} is in your first team — take him out of the XI first',
  'error.list.coverKeeper': 'Selling {player} would leave you with one goalkeeper',
  'error.tactics.range': 'Tactics must sit between 0 and 100',
  'error.season.notOver': 'The season is not over yet',
  'error.ticket.range': 'A ticket must be priced between {low} and {high}',
  'error.expansion.underWay': 'Building work is already under way',
  'error.expansion.range': 'An expansion runs from {min} to {max} seats',
  'error.club.notYours': 'That is not your club',
  'error.lineup.shape': 'That eleven does not fit the formation',
  'error.season.over': 'The season is over',
  'error.career.over': 'The board have dismissed you',

  // ── The front page ──────────────────────────────────────────────────────────
  'action.quit': 'Leave career',
  'hub.confirmQuit':
    'Leave this career? It stays where it is and Continue will bring you back — but save it if you want it once you have started another.',
  'landing.tagline': 'Take charge of a Spanish club.',
  'landing.about.p1':
    'A football management game in the idiom of the Spanish CD-ROMs of the nineties. There is no match to watch: you pick the eleven, set the approach, and the result is resolved on the numbers.',
  'landing.about.p2':
    'You run one club through a season — the squad, the tactics, the transfer market, the wage bill, the ground, and a board that expects a league position. The rest of the division is run by the game.',
  'landing.about.p3':
    'A career is deterministic: the same decisions always produce the same season. Save whenever you like — the day clock, the market and the draw all travel with the file.',
  'landing.continue': 'Continue',
  'landing.load': 'Load game',
  'shell.build': 'Build',
}
