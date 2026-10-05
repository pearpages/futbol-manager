import { transferWindowDaysLeft } from '@fm/domain'
import { BadgeDefs, Button, Icon, Panel, Segments, TabBar, VisuallyHidden } from '@fm/design-system'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { PhoneAction } from './PhoneAction.tsx'
import { PhoneMenu } from './PhoneMenu.tsx'
import { TABS, tabOf } from './tabs.ts'
import './PhoneShell.css'

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
 * The game on a phone (ADR 0019): one line at the top, the screen, then the
 * next thing to do and the five places, both under the thumb.
 *
 * The desk shell is a frame with a hub you return to; on a phone that hub is a
 * long scroll you kept going back through. Here every place is one press from
 * every other, and the press that runs the game — the clock, the match — is on
 * every screen.
 */
export function PhoneShell({ children }: { readonly children: React.ReactNode }) {
  const game = useGame((s) => s.game)
  const screen = useGame((s) => s.screen)
  const inspectedFrom = useGame((s) => s.inspectedFrom)
  const go = useGame((s) => s.go)
  const inspect = useGame((s) => s.inspect)
  const { t, plural } = useT()

  const tab = tabOf(screen, inspectedFrom)
  const entry = TABS.find((e) => e.tab === tab) ?? TABS[0]
  const title = screen === 'player' ? t('nav.player') : t(entry?.label ?? 'tab.today')
  const segments = screen === 'player' ? [] : (entry?.screens ?? [])
  const windowDaysLeft = transferWindowDaysLeft(game.season.currentDate)
  const offers = game.bids.filter((b) => b.to === game.managedClubId && b.status === 'pending')

  return (
    <div className="shell shell--phone">
      <BadgeDefs />
      <Panel as="header" className="phone-bar">
        {screen === 'player' && (
          <Button
            type="button"
            className="phone-bar__icon-button"
            aria-label={t('action.back')}
            onClick={() => {
              inspect(null)
            }}
          >
            <Icon name="back" />
          </Button>
        )}
        <h1 className="phone-bar__title">{title}</h1>
        {/* The one deadline the game enforces, and a way straight to it. */}
        {windowDaysLeft !== null && (
          <Button
            type="button"
            className="phone-bar__window"
            onClick={() => {
              go('market')
            }}
          >
            <Icon name="transfer" />
            <span aria-hidden="true">{t('shell.windowDays', { days: windowDaysLeft })}</span>
            <VisuallyHidden>{plural('shell.windowOpen', windowDaysLeft)}</VisuallyHidden>
          </Button>
        )}
        <PhoneMenu />
      </Panel>

      <main className="shell__stage">
        {segments.length > 1 && (
          <Segments
            className="phone-segments"
            label={title}
            options={segments.map((s) => ({ value: s, label: t(SEGMENT_TITLES[s] ?? s) }))}
            value={screen}
            onChange={go}
          />
        )}
        {children}
      </main>

      <div className="phone-dock">
        <PhoneAction />
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
    </div>
  )
}
