import { useEffect, useRef, useState } from 'react'
import { transferWindowDaysLeft } from '@fm/domain'
import {
  BadgeDefs,
  Button,
  HubFigure,
  Icon,
  type IconKey,
  Panel,
  Segments,
  TabBar,
  TileIcon,
  VisuallyHidden,
} from '@fm/design-system'
import { useT } from '../i18n/useT.ts'
import { NewsDialog } from '../screens/NewsDialog.tsx'
import { useGame } from '../store.ts'
import { ShellCredit } from '../screens/ShellCredit.tsx'
import { artSrc } from '../screens/art.ts'
import { usePhone } from '../usePhone.ts'
import { DayAction } from './DayAction.tsx'
import { GameMenu } from './GameMenu.tsx'
import { TABS, tabOf } from './tabs.ts'
import './Shell.css'

/** What a screen is called when it is one segment of a tab. */
const SEGMENT_TITLES: Readonly<Record<string, string>> = {
  lineup: 'nav.lineup',
  squad: 'nav.squad',
  table: 'nav.table',
  results: 'nav.results',
  calendar: 'nav.calendar',
  caja: 'nav.caja',
  decisiones: 'nav.decisiones',
  estadio: 'nav.estadio',
}

/**
 * Each segment's picture: the one its hub tile carries on the desk, so a place
 * looks the same on both layouts.
 */
const SEGMENT_ICONS: Readonly<Record<string, IconKey>> = {
  lineup: 'pitch',
  squad: 'roster',
  table: 'table',
  results: 'results',
  calendar: 'calendar',
  caja: 'safe',
  decisiones: 'scales',
  estadio: 'stadium',
}

/**
 * The game on a phone (ADR 0019): one line at the top, the screen, then the
 * next thing to do and the five places, both under the thumb.
 *
 * The desk shell is a frame with a hub you return to; on a phone that hub is a
 * long scroll you kept going back through. Here every place is one press from
 * every other, and the press that runs the game — the clock, the match — is on
 * every screen.
 */
export function Shell({ children }: { readonly children: React.ReactNode }) {
  const game = useGame((s) => s.game)
  const screen = useGame((s) => s.screen)
  const inspectedFrom = useGame((s) => s.inspectedFrom)
  const go = useGame((s) => s.go)
  const inspect = useGame((s) => s.inspect)
  const { t, plural, date } = useT()
  const unread = useGame((s) => s.unread)
  const markRead = useGame((s) => s.markRead)
  const [newsOpen, setNewsOpen] = useState(false)
  const phone = usePhone()
  const inspectedPlayerId = useGame((s) => s.inspectedPlayerId)
  const heading = useRef<HTMLHeadingElement>(null)
  // What the shell's live region says: the place you moved to, or the new day.
  // One region that is always there, because one inserted already holding its
  // words is ignored by many screen readers.
  const [said, setSaid] = useState('')

  const tab = tabOf(screen, inspectedFrom)
  const entry = TABS.find((e) => e.tab === tab) ?? TABS[0]
  const title = screen === 'player' ? t('nav.player') : t(entry?.label ?? 'tab.today')
  const segments = screen === 'player' ? [] : (entry?.screens ?? [])
  const windowDaysLeft = transferWindowDaysLeft(game.season.currentDate)
  const offers = game.bids.filter((b) => b.to === game.managedClubId && b.status === 'pending')

  // The tab's own title, so history, bookmarks and a screen reader's window
  // list name the place, and the page's title back once the career is left.
  useEffect(() => {
    const before = document.title
    return () => {
      document.title = before
    }
  }, [])
  useEffect(() => {
    document.title = t('shell.documentTitle', { screen: title })
  }, [t, title])

  // A new screen says where you are (WCAG 2.4.3, 4.1.3). Pressing a link that
  // leaves the screen takes its button with it and drops focus onto <body>, so
  // focus goes to the new screen's title; when the control you pressed is still
  // there, a tab or a segment, focus stays on it and the region names the place.
  const place = `${screen}:${inspectedPlayerId ?? ''}`
  const arrived = useRef(false)
  useEffect(() => {
    const active = document.activeElement
    if (active === null || active === document.body) heading.current?.focus()
    else if (arrived.current) setSaid(title)
    arrived.current = true
    // Keyed on `place` alone: `title` follows it, and listing it would announce
    // a change of language as if it were a move.
  }, [place])

  // Advancing a day changes the date and brings news with no other sign to a
  // screen reader: say both.
  const day = game.season.currentDate
  const seenDay = useRef(day)
  const seenUnread = useRef(unread)
  useEffect(() => {
    const fresh = unread - seenUnread.current
    seenUnread.current = unread
    if (seenDay.current === day) return
    seenDay.current = day
    const news = fresh > 0 ? ` ${plural('shell.newsAnnounce', fresh)}` : ''
    setSaid(`${t('shell.dayAnnounce', { date: date(day) })}${news}`)
  }, [day, unread, t, plural, date])

  return (
    <div className="shell shell--app" data-place={tab}>
      <BadgeDefs />
      <VisuallyHidden role="status">{said}</VisuallyHidden>
      <Panel as="header" className="shell-bar">
        {screen === 'player' && (
          <Button
            type="button"
            className="shell-bar__icon-button"
            aria-label={t('action.back')}
            onClick={() => {
              inspect(null)
            }}
          >
            <Icon name="back" />
          </Button>
        )}
        <h1 className="shell-bar__title" ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {/* The one deadline the game enforces, and a way straight to it. */}
        {windowDaysLeft !== null && (
          <Button
            type="button"
            className="shell-bar__window"
            onClick={() => {
              go('market')
            }}
          >
            <Icon name="transfer" />
            <span aria-hidden="true">{t('shell.windowDays', { days: windowDaysLeft })}</span>
            <VisuallyHidden>{plural('shell.windowOpen', windowDaysLeft)}</VisuallyHidden>
          </Button>
        )}
        {/* News lands wherever you are, so its door is in the bar on every
            screen. Opening it is what marks it read, as on the hub. */}
        <Button
          type="button"
          className="shell-bar__icon-button shell-bar__news"
          onClick={() => {
            setNewsOpen(true)
            markRead()
          }}
        >
          <Icon name="news" />
          <VisuallyHidden>{t('hub.news')}</VisuallyHidden>
          {unread > 0 && (
            <>
              <span className="shell-bar__badge" aria-hidden="true">
                {unread}
              </span>{' '}
              <VisuallyHidden>{plural('action.unread', unread)}</VisuallyHidden>
            </>
          )}
        </Button>
        <GameMenu inline={!phone} />
      </Panel>

      <main className="shell__stage">
        {segments.length > 1 && (
          <Segments
            className="shell-segments"
            label={title}
            options={segments.map((s) => {
              const icon = SEGMENT_ICONS[s]
              return {
                value: s,
                label: t(SEGMENT_TITLES[s] ?? s),
                ...(icon === undefined ? {} : { icon: <TileIcon icon={icon} /> }),
              }
            })}
            value={screen}
            onChange={go}
          />
        )}
        {children}
      </main>

      {newsOpen && (
        <NewsDialog
          onClose={() => {
            setNewsOpen(false)
          }}
        />
      )}

      <div className="shell-dock">
        {/* The place's member of staff at the foot of the rail, where PC Fútbol
            stood them at the foot of their section. Decoration, and desk only:
            a phone has no room under its tabs. */}
        {!phone && entry?.figure != null && (
          <div className="shell-figure">
            <HubFigure figure={entry.figure} src={artSrc(entry.figure)} />
          </div>
        )}
        <DayAction />
        <TabBar
          label={t('tab.nav')}
          items={TABS.map((e) => ({
            value: e.tab,
            label: t(e.label),
            icon: e.icon,
            ...(e.tab === 'market'
              ? { badge: offers.length, badgeLabel: t('tab.offersWaiting') }
              : {}),
          }))}
          value={tab}
          onChange={(next) => {
            const first = TABS.find((e) => e.tab === next)?.screens[0]
            if (first !== undefined) go(first)
          }}
        />
      </div>

      {/* On a phone the credit is in the menu; on the desk, under the frame. */}
      {!phone && <ShellCredit />}
    </div>
  )
}
