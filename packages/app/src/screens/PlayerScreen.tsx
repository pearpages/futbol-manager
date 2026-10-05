import {
  ATTACK_WEIGHTS,
  ATTRIBUTE_KEYS,
  type Attributes,
  ageOn,
  DEFENCE_WEIGHTS,
  expectedGoals,
  type Formation,
  isTransferWindowOpen,
  overall,
  type Player,
  playerAttack,
  playerDefence,
  POSITION_WEIGHTS,
  positionShare,
  saleBlock,
  type TeamRating,
  toCivil,
} from '@fm/domain'
import { useState } from 'react'
import { useGame } from '../store.ts'
import { useT, type Translator } from '../i18n/useT.ts'
import {
  AttrBar,
  AttributeRadar,
  Button,
  Field,
  FieldLabel,
  Hint,
  Screen,
  ScreenActions,
  ScreenHeading,
  ScreenNote,
  Select,
  Stat,
  StatLabel,
  StatValue,
} from '@fm/design-system'
import { BidPanel } from './BidPanel.tsx'
import { ClubBadge } from './ClubBadge.tsx'
import { PlayerLink } from './PlayerLink.tsx'
import { RenewPanel } from './RenewPanel.tsx'
import { positionChip } from './SquadScreen.tsx'
import './PlayerScreen.css'

/**
 * The ficha — the player card this genre is built around.
 *
 * Three things, in the order a manager asks them. **The shape**: eight attributes
 * as a polygon, because a silhouette says in one look what a list of numbers does
 * not. **The comparison**: a second player from your own squad laid over the same
 * axes, which is the only honest way to answer "is he better than what I have"
 * without navigating away and memorising eight numbers. **What any of it means**:
 * which attributes feed his overall, his attacking and his defensive rating, and
 * what one man in his position is worth to the team.
 *
 * That last block states percentages, and every one of them is read from the same
 * constants the resolver runs on. A weight restated as prose in a dictionary is a
 * second copy of a calibrated model, and it would be wrong the first time anyone
 * touched `POSITION_WEIGHTS`.
 *
 * What it deliberately does **not** show is what this player would add to *your*
 * XI. That number exists — `needFor` — and it was taken off the market screen on
 * purpose, because it turns buying into a lookup: read the top row, sign him. The
 * block below describes the model, which is identical for every player in a
 * position, and leaves the judgement where it belongs.
 */

/**
 * Where an attribute bar starts, and how much of one bucket a point is worth.
 *
 * **Bars are plotted from 40, not from zero.** Ratings live in 60–94 and attributes
 * in roughly 45–99, so measuring from zero spends more than half of every bar on
 * range nothing occupies — twenty players would draw twenty near-identical bars, and
 * a bar that cannot separate anything is decoration. Forty is under the lowest real
 * attribute with room to spare, so nothing clips and the visible half is the half
 * that varies.
 *
 * The bucket count is still the twenty-one `chrome.css` declares. `EstadioScreen`
 * fills the same primitive from an occupancy *fraction*, so the rebasing lives here
 * rather than in the shared helper.
 */
const BAR_FLOOR = 45
const BAR_STEP = 2.7

function fillFor(value: number): number {
  return Math.max(0, Math.min(20, Math.round((value - BAR_FLOOR) / BAR_STEP)))
}

/**
 * Colour marks only the extremes: a bar is neutral unless it is worth noticing.
 *
 * Re-cut for the 60–94 scale. At the old 80 / 40 an ordinary Primera player would
 * light up as strong and `is-weak` would never fire at all, since nothing is below
 * 60 any more.
 */
function band(value: number): string {
  if (value >= 85) return ' is-strong'
  if (value <= 64) return ' is-weak'
  return ''
}

/** The illustration point for what a rating edge is worth. Nothing depends on it. */
const SAMPLE_EDGE = 5

/** An even matchup, used only to measure the model against itself. */
const EVEN: TeamRating = { attack: 75, defence: 75, tempo: 0 }

interface Weighting {
  readonly key: keyof Attributes
  readonly weight: number
}

/** The attributes a rating actually uses, heaviest first. */
function ranked(weights: Readonly<Partial<Attributes>>): Weighting[] {
  return ATTRIBUTE_KEYS.filter((key) => (weights[key] ?? 0) > 0)
    .map((key) => ({ key, weight: weights[key] ?? 0 }))
    .sort((a, b) => b.weight - a.weight)
}

/** The ones worth exactly nothing — the more useful half of the answer. */
function ignored(weights: Readonly<Partial<Attributes>>): (keyof Attributes)[] {
  return ATTRIBUTE_KEYS.filter((key) => (weights[key] ?? 0) === 0)
}

function ModelGroup({
  title,
  weights,
  note,
  t,
  percent,
}: {
  readonly title: string
  readonly weights: Readonly<Partial<Attributes>>
  readonly note?: string | undefined
  readonly t: Translator['t']
  readonly percent: Translator['percent']
}) {
  const used = ranked(weights)
  const unused = ignored(weights)

  return (
    <div className="model-group">
      <h4 className="model-group__title">{title}</h4>
      {note !== undefined && <Hint>{note}</Hint>}
      {used.length > 0 && (
        <ul className="model-group__list">
          {used.map((entry) => (
            <li key={entry.key} className="model-group__row">
              <span className="model-group__name">{t(`attribute.${entry.key}`)}</span>
              <span className="model-group__share">{percent(entry.weight)}</span>
            </li>
          ))}
        </ul>
      )}
      {/* Only against a list. A keeper's attack group is a single sentence saying
          he contributes nothing, and following it with all eight attributes named
          as contributing nothing says the same thing twice and worse. */}
      {used.length > 0 && unused.length > 0 && (
        <p className="model-group__unused">
          {t('player.model.unused', {
            attributes: unused.map((key) => t(`attribute.${key}`)).join(', '),
          })}
        </p>
      )}
    </div>
  )
}

export function PlayerScreen() {
  const game = useGame((s) => s.game)
  const dispatch = useGame((s) => s.dispatch)
  const playerId = useGame((s) => s.inspectedPlayerId)
  const comparedId = useGame((s) => s.comparedPlayerId)
  const compare = useGame((s) => s.compare)
  const { t, percent, money } = useT()
  const [renewing, setRenewing] = useState(false)
  const [bidding, setBidding] = useState(false)

  const squad = game.squads[game.managedClubId] ?? []
  // The ficha reads anyone in the game, not only your own players — the market
  // screen opens it for a target you are thinking about bidding for, and a card
  // that only worked for players you already own would be useless there.
  //
  // The owning club comes back with him. Every name in the app is now a way onto
  // this card, so it is reached far more often for somebody else's player than it
  // used to be, and a card that will not say who he plays for is a card you have
  // to leave to find out.
  // Abroad counts as an owner. Without this a foreign player's card claims he is
  // a free agent and shows no badge — and the bid action, which is gated on there
  // being an owner, never appears for the players the abroad layer exists for.
  const domesticOwner = game.clubs.find((c) =>
    (game.squads[c.id] ?? []).some((p) => p.id === playerId),
  )
  const foreignOwner =
    domesticOwner !== undefined
      ? undefined
      : game.foreign.clubs.find((c) =>
          (game.foreign.squads[c.id] ?? []).some((p) => p.id === playerId),
        )
  const owner = domesticOwner ?? foreignOwner
  const ownerSquad =
    domesticOwner !== undefined
      ? (game.squads[domesticOwner.id] ?? [])
      : foreignOwner !== undefined
        ? (game.foreign.squads[foreignOwner.id] ?? [])
        : []
  const player =
    squad.find((p) => p.id === playerId) ??
    ownerSquad.find((p) => p.id === playerId) ??
    game.freeAgents.find((p) => p.id === playerId)

  if (player === undefined) {
    return (
      <Screen>
        <ScreenHeading>{t('player.none')}</ScreenHeading>
        <ScreenNote>{t('player.pickOne')}</ScreenNote>
      </Screen>
    )
  }

  const lineup = game.lineups[game.managedClubId]
  // Whether he is in the XI is a question about *your* team sheet, so it is only
  // a question at all for one of yours. It used to be answered for everybody:
  // a rival you were scouting was told "On the bench. Change the lineup to start
  // them", which is both false and an instruction you cannot follow.
  const isYours = squad.some((p) => p.id === player.id)
  const isStarting = lineup?.starters.includes(player.id) ?? false
  const formation: Formation = lineup?.formation ?? '4-4-2'
  // Listing one of yours is on his card at every width (ADR 0022); the desk's
  // squad table carries the same button as well, because it has the room.
  const onSale = game.transferList.includes(player.id)
  const block = isYours ? saleBlock(squad, lineup, player) : null

  // Only ever one of yours, and never the man whose card this is. A squad that
  // changes under the comparison — he was sold — simply drops it.
  const compared: Player | undefined =
    comparedId === null ? undefined : squad.find((p) => p.id === comparedId && p.id !== player.id)

  const values = ATTRIBUTE_KEYS.map((key) => player.attributes[key])
  const otherValues =
    compared === undefined ? undefined : ATTRIBUTE_KEYS.map((key) => compared.attributes[key])

  const share = positionShare(player.position, formation)
  const positionName = t(`position.${player.position}`)
  // Stated by asking the resolver rather than by quoting a constant, so it stays
  // true if the calibration ever moves.
  const edge = expectedGoals({ ...EVEN, attack: EVEN.attack + SAMPLE_EDGE }, EVEN, false)
  const ratio = edge / expectedGoals(EVEN, EVEN, false) - 1

  return (
    <Screen className="ficha">
      <header className="ficha__head">
        <div className="ficha__identity">
          {positionChip(player.position, positionName)}
          <h2 className="ficha__name">{player.name}</h2>
          {/* Who he plays for. Reuses `market.freeAgent` rather than adding a
              fourth entry to three dictionaries for a fact already worded once
              — the same call the form strip made with `news.won`. */}
          {owner === undefined ? (
            <span className="ficha__free">{t('market.freeAgent')}</span>
          ) : (
            <ClubBadge club={owner} labelled />
          )}
        </div>
      </header>

      <dl className="ficha__vitals">
        <Stat>
          <StatLabel as="dt">{t('player.overall')}</StatLabel>
          <StatValue as="dd">{overall(player)}</StatValue>
        </Stat>
        <Stat>
          <StatLabel as="dt">{t('player.age')}</StatLabel>
          <StatValue as="dd">{ageOn(player, game.season.currentDate)}</StatValue>
        </Stat>
        <Stat>
          <StatLabel as="dt">{t('player.attack')}</StatLabel>
          <StatValue as="dd">{Math.round(playerAttack(player))}</StatValue>
        </Stat>
        <Stat>
          <StatLabel as="dt">{t('player.defence')}</StatLabel>
          <StatValue as="dd">{Math.round(playerDefence(player))}</StatValue>
        </Stat>
        {/* The terms. A ficha that says how good he is and not what he costs is
            half a card — and for a market target it is the half you are buying. */}
        <Stat>
          <StatLabel as="dt">{t('player.wage')}</StatLabel>
          <StatValue as="dd">{money(player.contract.wage)}</StatValue>
        </Stat>
        <Stat>
          <StatLabel as="dt">{t('player.contract')}</StatLabel>
          <StatValue as="dd">{toCivil(player.contract.until).y}</StatValue>
        </Stat>
      </dl>

      <div className="ficha__body">
        <div className="ficha__chart">
          <AttributeRadar
            values={values}
            compare={otherValues}
            labels={ATTRIBUTE_KEYS.map((key) => t(`attribute.short.${key}`))}
            title={t('player.radar', { name: player.name })}
          />

          {compared !== undefined && (
            <ul className="radar-key">
              {/* Only the other man is a route out. `inspect` clears the
                  comparison on every open, so a link on the subject's own name
                  would destroy the comparison this key exists to explain — and
                  navigate nowhere doing it. */}
              <li className="radar-key__item">
                <span className="radar-key__swatch is-a" />
                {player.name}
              </li>
              <li className="radar-key__item">
                <span className="radar-key__swatch is-b" />
                <PlayerLink player={compared} />
              </li>
            </ul>
          )}

          <Field as="label" className="ficha__compare">
            <FieldLabel as="span">{t('player.compare')}</FieldLabel>
            <Select
              value={compared?.id ?? ''}
              onChange={(event) => compare(event.target.value === '' ? null : event.target.value)}
            >
              <option value="">{t('player.compareNone')}</option>
              {squad
                .filter((p) => p.id !== player.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {t('player.compareOption', {
                      name: p.name,
                      position: t(`position.${p.position}`),
                      overall: overall(p),
                    })}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        <div className="ficha__attributes">
          {ATTRIBUTE_KEYS.map((key, index) => {
            const value = player.attributes[key]
            const other = otherValues?.[index]
            const difference = other === undefined ? 0 : value - other
            return (
              <AttrBar key={key} className={`${other === undefined ? '' : ' is-compare'}`}>
                <span className="attr__label">{t(`attribute.${key}`)}</span>
                <span className="attr__track">
                  {/* Width comes from a bucketed data attribute rather than an
                      inline style: the convention keeps every styling decision in
                      CSS, and 5% steps are visually indistinguishable from exact. */}
                  <span className={`attr__fill${band(value)}`} data-fill={fillFor(value)} />
                </span>
                <span className={`attr__value${other === undefined ? '' : ' is-a'}`}>{value}</span>
                {other !== undefined && <span className="attr__value is-b">{other}</span>}
                {other !== undefined && (
                  <span
                    className={`attr__delta${difference > 0 ? ' is-up' : difference < 0 ? ' is-down' : ''}`}
                  >
                    {difference > 0 ? `+${String(difference)}` : String(difference)}
                  </span>
                )}
              </AttrBar>
            )
          })}
        </div>
      </div>

      <section className="ficha__model">
        <h3 className="ficha__model-heading">{t('player.model.heading')}</h3>

        <div className="ficha__model-groups">
          <ModelGroup
            title={t('player.model.overall', { position: positionName })}
            weights={POSITION_WEIGHTS[player.position]}
            t={t}
            percent={percent}
          />
          <ModelGroup
            title={t('player.model.attack')}
            weights={player.position === 'GK' ? {} : ATTACK_WEIGHTS}
            note={player.position === 'GK' ? t('player.model.keeperAttack') : undefined}
            t={t}
            percent={percent}
          />
          <ModelGroup
            title={t('player.model.defence')}
            // A keeper's defensive rating *is* his keeping, exactly and only.
            weights={player.position === 'GK' ? { keeping: 1 } : DEFENCE_WEIGHTS}
            note={player.position === 'GK' ? t('player.model.keeperDefence') : undefined}
            t={t}
            percent={percent}
          />
        </div>

        <p className="ficha__model-note">
          {t(player.position === 'GK' ? 'player.model.keeperShare' : 'player.model.share', {
            formation,
            attack: percent(share.attack, 1),
            defence: percent(share.defence, 1),
          })}
        </p>
        <p className="ficha__model-note">
          {t('player.model.result', { points: SAMPLE_EDGE, ratio: percent(ratio) })}
        </p>
      </section>

      {isYours && (
        <p className="ficha__status">{t(isStarting ? 'player.inXI' : 'player.onBench')}</p>
      )}

      {/* Two actions, and each is gated on the half of the world it belongs to.
          Renewing somebody else's player is not a thing you can do; bidding for
          your own is the reducer's `error.player.yours`. A free agent has no
          owner and costs no fee — he goes through `OfferContract` on the market
          screen instead, which is why the bid button needs `owner`. */}
      {isYours && (
        <ScreenActions className="ficha__actions">
          <Button
            icon="tag"
            primary={onSale}
            type="button"
            aria-pressed={onSale}
            disabled={block !== null && !onSale}
            onClick={() => dispatch({ type: 'ListPlayer', playerId: player.id, on: !onSale })}
          >
            {onSale ? t('squad.listed') : t('squad.list')}
          </Button>
          <Button icon="sign" type="button" onClick={() => setRenewing(true)}>
            {t('squad.renew')}
          </Button>
        </ScreenActions>
      )}

      {!isYours && owner !== undefined && (
        <ScreenActions className="ficha__actions">
          {/* Disabled rather than hidden while the window is shut: the button
              disappearing would read as "you cannot buy this man" rather than
              "not today". */}
          <Button
            icon="cash"
            type="button"
            disabled={!isTransferWindowOpen(game.season.currentDate)}
            onClick={() => setBidding(true)}
          >
            {t('player.bid')}
          </Button>
        </ScreenActions>
      )}

      {isYours && renewing && (
        <RenewPanel key={player.id} player={player} onClose={() => setRenewing(false)} />
      )}

      {!isYours && owner !== undefined && bidding && (
        <BidPanel key={player.id} player={player} owner={owner} onClose={() => setBidding(false)} />
      )}
    </Screen>
  )
}
