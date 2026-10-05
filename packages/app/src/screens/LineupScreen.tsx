import {
  bestXI,
  canField,
  FORMATION_NAMES,
  FORMATIONS,
  type Formation,
  overall,
  type Player,
  type PlayerId,
  type Position,
  startersOf,
  teamRating,
} from '@fm/domain'
import { useState } from 'react'
import type { Lineup } from '@fm/domain'
import { useT } from '../i18n/useT.ts'
import { useGame } from '../store.ts'
import { usePhone } from '../usePhone.ts'
import { Explain } from './Explain.tsx'
import { PlayerLink } from './PlayerLink.tsx'
import { positionChip } from './SquadScreen.tsx'
import {
  Button,
  Field,
  FieldLabel,
  Hint,
  Modal,
  Toast,
  PitchView,
  Screen,
  ScreenHeading,
  Slider,
  Stat,
  StatLabel,
  StatValue,
} from '@fm/design-system'
import './LineupScreen.css'

const POSITIONS: readonly Position[] = ['GK', 'DF', 'MF', 'FW']

export function LineupScreen() {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const { t, plural } = useT()
  const [selected, setSelected] = useState<PlayerId | null>(null)
  const phone = usePhone()
  // The XI a formation press replaced, for one undo. Kept with its day: once the
  // clock moves on the squad may have changed under it, and the offer lapses.
  const [replaced, setReplaced] = useState<{
    readonly lineup: Lineup
    readonly day: number
  } | null>(null)

  const clubId = game.managedClubId
  const squad = game.squads[clubId] ?? []
  const lineup = game.lineups[clubId]
  const tactics = game.tactics[clubId] ?? { attacking: 50 }
  if (lineup === undefined) return null

  const starters = new Set<PlayerId>(lineup.starters)
  const shape = FORMATIONS[lineup.formation]
  const starterList = startersOf(squad, lineup)
  const rating = teamRating(starterList, tactics)

  /**
   * Resolved against the *live* XI, never against the squad.
   *
   * `NegotiationPanel` shipped the other version of this and it was invisible for
   * a month: a target that outlives the thing that selected it leaves the last
   * man's name on screen. Any `SetLineup` — a formation button, the reducer's own
   * re-pick after a sale — drops him out of `starters` and the panel goes back to
   * its prompt on its own.
   */
  const selectedPlayer =
    selected !== null && starters.has(selected)
      ? (squad.find((player) => player.id === selected) ?? null)
      : null

  /**
   * The whole bench, or the part of it that can come on for the selected man.
   *
   * Idle it is the reference's third section — `squad-alineacion-formacion.png`
   * splits the squad into starting XI, called up and not called up — so the panel
   * says who is available rather than holding a sentence asking you to press
   * something. Selecting a starter narrows it to his position, which is the only
   * swap the reducer will accept anyway.
   */
  const substitutes = squad
    .filter(
      (p) =>
        !starters.has(p.id) && (selectedPlayer === null || p.position === selectedPlayer.position),
    )
    .sort((a, b) => POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position))

  /** Swaps one starter for one substitute of the same position, keeping the XI legal. */
  const swap = (out: PlayerId, incoming: PlayerId) => {
    dispatch({
      type: 'SetLineup',
      clubId,
      lineup: { ...lineup, starters: lineup.starters.map((id) => (id === out ? incoming : id)) },
    })
    setSelected(null)
  }

  const setFormation = (formation: Formation) => {
    dispatch({ type: 'SetLineup', clubId, lineup: bestXI(squad, formation) })
    setReplaced({ lineup, day: game.season.currentDate })
    setSelected(null)
  }

  const pick = (id: PlayerId) => setSelected((current) => (current === id ? null : id))

  const slotLabel = (player: Player) =>
    t('lineup.slotLabel', {
      position: t(`position.${player.position}`),
      name: player.name,
      overall: overall(player),
    })

  return (
    <div className="lineup-screen">
      {/* Left is the team sheet: what it is worth, who is in, who is out. */}
      <div className="lineup-screen__sheet">
        {/* The heading and the figures are siblings inside the section on
            purpose — `App.test.tsx` walks from the heading to `parentElement`
            and expects to find the numbers there. The hint that used to sit
            under them is the `title`: still said, but not costing three rows of
            the eleven below. */}
        <Screen className="lineup-screen__vitals" title={t('lineup.ratingHint')}>
          <ScreenHeading>
            {t('lineup.thisXI')}
            <Explain topic="teamRating" />
          </ScreenHeading>
          <div className="lineup-screen__ratings">
            <Stat>
              <StatLabel>{t('lineup.attack')}</StatLabel>
              <StatValue>{rating.attack}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>{t('lineup.defence')}</StatLabel>
              <StatValue>{rating.defence}</StatValue>
            </Stat>
            <Stat>
              <StatLabel>
                {t('lineup.tempo')}
                <Explain topic="tempo" />
              </StatLabel>
              <StatValue className="lineup-screen__word">
                {t(describeTempo(rating.tempo))}
              </StatValue>
            </Stat>
          </div>
        </Screen>

        <Screen className="lineup-screen__xi">
          <ScreenHeading>{t('lineup.startingXI')}</ScreenHeading>
          {POSITIONS.map((position) => {
            const inXI = squad.filter((p) => p.position === position && starters.has(p.id))

            return (
              <div key={position} className="lineup-group">
                <h3 className="lineup-group__title">
                  {positionChip(position, t(`position.${position}`))}{' '}
                  <span>{t('lineup.needed', { count: shape[position] })}</span>
                </h3>
                {inXI.map((player: Player) => (
                  <div
                    key={player.id}
                    className={`lineup-row${player.id === selectedPlayer?.id ? ' is-selected' : ''}`}
                  >
                    <PlayerLink player={player} className="lineup-row__name" />
                    <span className="lineup-row__ovr">{overall(player)}</span>
                    {/* The list's own way into the swap, so the pitch is not the
                      only one. One control with two entry points, not two
                      controls — and cheap insurance, given that a `<g>` carrying
                      `tabIndex` is the one part of this screen no test can prove
                      behaves in a real browser. */}
                    <Button
                      icon="transfer"
                      type="button"
                      className="lineup-row__pick"
                      aria-pressed={player.id === selectedPlayer?.id}
                      onClick={() => pick(player.id)}
                    >
                      {t('lineup.pick')}
                    </Button>
                  </div>
                ))}
              </div>
            )
          })}
        </Screen>

        {/* Pinned as its own row, never scrolling away with the eleven above it.
            That is what makes it safe for the bench to sit across the screen
            from the pitch: the M4b transfer bug was an answer rendered outside
            the viewport, not an answer a few centimetres away. */}
        <Screen className="lineup-screen__bench">
          <ScreenHeading>{t('lineup.bench')}</ScreenHeading>
          <div className="lineup-screen__bench-body">
            {/* Always one line here, never none. It carries the count idle — the
                list caps at four rows and scrolls, so "17 available" is the only
                thing saying there are thirteen more — and the question when a
                man is picked. A line that comes and goes would resize this panel
                on every click, and the panel below the eleven resizing means a
                striker drops out of the list above it. */}
            <Hint>
              {selectedPlayer === null
                ? plural('lineup.available', substitutes.length)
                : t('lineup.replacing', { name: selectedPlayer.name })}
            </Hint>
            {substitutes.length === 0 ? (
              <Hint>{t('lineup.noSubs')}</Hint>
            ) : (
              <ul className="lineup-screen__subs">
                {substitutes.map((sub) => (
                  <li key={sub.id}>
                    {/* A row is only a control once there is somebody to swap
                        him for. Idle it states who is available — the
                        reference's not-called-up list — and stays out of the
                        accessibility tree, where a dozen extra buttons would
                        collide with the name queries this screen leans on. */}
                    {selectedPlayer === null ? (
                      <div className="lineup-screen__sub is-idle">
                        {positionChip(sub.position, t(`position.${sub.position}`))}
                        <span className="lineup-row__name">{sub.name}</span>
                        <span className="lineup-row__ovr">{overall(sub)}</span>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        className="lineup-screen__sub"
                        onClick={() => swap(selectedPlayer.id, sub.id)}
                      >
                        {positionChip(sub.position, t(`position.${sub.position}`))}
                        <span className="lineup-row__name">{sub.name}</span>
                        <span className="lineup-row__ovr">{overall(sub)}</span>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Screen>
      </div>

      {/* Right is the system, and the system drawn. They are cause and effect —
          pressing a shape is a change to the pitch — so they share a column. */}
      <div className="lineup-screen__system">
        <Screen className="lineup-screen__panel">
          <ScreenHeading>{t('lineup.shape')}</ScreenHeading>
          <div className="lineup-screen__body">
            <Field>
              <FieldLabel as="span">{t('lineup.formation')}</FieldLabel>
              <div className="lineup-screen__formations">
                {FORMATION_NAMES.map((formation) => {
                  // `bestXI` throws on a squad short at any bank, and `setFormation`
                  // calls it before dispatching — so an enabled button here is an
                  // uncaught throw in an event handler, with no error boundary.
                  const playable = canField(squad, formation)
                  return (
                    <Button
                      primary={formation === lineup.formation}
                      key={formation}
                      type="button"
                      disabled={!playable}
                      {...(playable ? {} : { title: t('lineup.cannotField') })}
                      onClick={() => setFormation(formation)}
                    >
                      {formation}
                    </Button>
                  )
                })}
              </div>
              <Hint>{t('lineup.formationHint')}</Hint>
            </Field>

            <Field>
              <FieldLabel htmlFor="attacking">
                {t('lineup.approach', { approach: t(describeApproach(tactics.attacking)) })}
              </FieldLabel>
              <Slider
                id="attacking"
                type="range"
                min={0}
                max={100}
                step={5}
                value={tactics.attacking}
                onChange={(event) =>
                  dispatch({
                    type: 'SetTactics',
                    clubId,
                    tactics: { attacking: Number(event.target.value) },
                  })
                }
              />
              <Hint>
                {t('lineup.approachHint')}
                <Explain topic="approach" />
              </Hint>
            </Field>
          </div>
        </Screen>

        <Screen className="lineup-screen__pitch-panel">
          <ScreenHeading>{t('lineup.pitch')}</ScreenHeading>
          <PitchView
            starters={starterList.map((player) => ({
              id: player.id,
              position: player.position,
              name: player.name,
              rating: overall(player),
              label: slotLabel(player),
            }))}
            selected={selectedPlayer?.id ?? null}
            onPick={(id) => {
              pick(id as PlayerId)
            }}
            title={t('lineup.pitch')}
          />
        </Screen>
      </div>

      {/* A formation press picks a whole new XI, hand-picked swaps and all.
          Rather than ask first, it says what it did and offers it back. */}
      {replaced !== null && replaced.day === game.season.currentDate && (
        <Toast
          className="shell-toast"
          message={t('lineup.formationChanged', { formation: lineup.formation })}
          actionLabel={t('action.undo')}
          onAction={() => {
            dispatch({ type: 'SetLineup', clubId, lineup: replaced.lineup })
          }}
          onDismiss={() => {
            setReplaced(null)
          }}
        />
      )}

      {/* Phone: the bench comes to the pitch instead of the other way round.
          A tapped disc opens his possible replacements as a sheet, where on
          the desk they are listed beside him (ADR 0019). */}
      {phone && selectedPlayer !== null && (
        <Modal
          title={t('lineup.replacing', { name: selectedPlayer.name })}
          onClose={() => {
            setSelected(null)
          }}
        >
          {substitutes.length === 0 ? (
            <Hint>{t('lineup.noSubs')}</Hint>
          ) : (
            <ul className="lineup-screen__swap-list">
              {substitutes.map((sub) => (
                <li key={sub.id}>
                  <Button
                    type="button"
                    className="lineup-screen__sub"
                    onClick={() => swap(selectedPlayer.id, sub.id)}
                  >
                    {positionChip(sub.position, t(`position.${sub.position}`))}
                    <span className="lineup-row__name">{sub.name}</span>
                    <span className="lineup-row__ovr">{overall(sub)}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  )
}

/** Returns a dictionary key, not a word — the caller translates it. */
function describeApproach(attacking: number): string {
  if (attacking >= 85) return 'approach.allOut'
  if (attacking >= 65) return 'approach.attacking'
  if (attacking > 35) return 'approach.balanced'
  if (attacking > 15) return 'approach.defensive'
  return 'approach.parkTheBus'
}

/**
 * How open the game is, as a word — the third number the resolver reads and the
 * only one with no control of its own.
 *
 * `tempo` is set by the slider *and* the formation together, which is exactly why
 * it needs saying out loud: neither control announces that it is also doing this.
 *
 * **The cuts are against the values that actually occur**, not rounded for looks.
 * The slider contributes −1…+1 and `FORMATION_TEMPO` −0.7…+0.4, so at the default
 * slider 4-2-4 reads Open, 5-4-1 and 4-5-1 read Tight, and the milder shapes stay
 * Balanced rather than overclaiming. Retune `FORMATION_TEMPO` and re-check that.
 *
 * Three bands where the approach slider has five: openness is a coarser thing than
 * mentality, and five words would imply a precision the model does not have.
 */
function describeTempo(tempo: number): string {
  if (tempo >= 0.35) return 'tempo.open'
  if (tempo > -0.35) return 'tempo.balanced'
  return 'tempo.tight'
}
