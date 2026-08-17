import { overall, type Player, type PlayerId } from '@fm/domain'
import { PITCH_MARKINGS, PITCH_VIEWBOX, pitchSlots, SLOT_RADIUS } from './pitch.ts'
import '../styles/pitch.css'

/**
 * The eleven, where they stand.
 *
 * The reference screen — `assets/pcfutbol-5.0/squad-alineacion-formacion.png` —
 * is a squad table *beside a pitch showing the shape*, and we had only ever built
 * the table half. A list tells you who is playing; only a pitch tells you that
 * picking 4-2-4 left two men in midfield.
 *
 * Inline SVG with classes only, no `style` prop, and **no colour value in this
 * file** — everything arrives through the custom properties in `pitch.css`, the
 * same arrangement `ClubBadge` and `AttributeRadar` use.
 *
 * **A slot is a `<g role="button">`, which owes a keyboard handler.** A real
 * `<button>` cannot be positioned inside an SVG without a `style` prop, and the
 * alternative — real buttons in a CSS grid — would put the slot geometry in the
 * stylesheet, which is exactly the split `badges.ts`, `radar.ts` and `sprites.ts`
 * established three times over. The cost is that Enter and Space have to be
 * synthesised by hand here, because only a real button gets them for free.
 * `lineup.test.tsx` covers both keys and covers that an ordinary key does
 * nothing.
 */

export interface PitchViewProps {
  /** In `lineup.starters` order — see `pitchSlots`, which depends on it. */
  readonly starters: readonly Player[]
  readonly selected: PlayerId | null
  readonly onPick: (id: PlayerId) => void
  /** Built by the caller, which owns the dictionary. */
  readonly label: (player: Player) => string
  readonly title: string
}

export function PitchView({ starters, selected, onPick, label, title }: PitchViewProps) {
  const slots = pitchSlots(starters.map((player) => player.position))

  return (
    <svg
      className="pitch"
      viewBox={PITCH_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={title}
    >
      <rect className="pitch__turf" {...PITCH_MARKINGS.outline} />
      <rect className="pitch__line" {...PITCH_MARKINGS.outline} />
      <line
        className="pitch__line"
        x1={PITCH_MARKINGS.outline.x}
        y1={PITCH_MARKINGS.halfway.y}
        x2={PITCH_MARKINGS.outline.x + PITCH_MARKINGS.outline.width}
        y2={PITCH_MARKINGS.halfway.y}
      />
      <circle
        className="pitch__line"
        cx={PITCH_MARKINGS.centre.x}
        cy={PITCH_MARKINGS.centre.y}
        r={PITCH_MARKINGS.centre.r}
      />
      {[...PITCH_MARKINGS.boxes, ...PITCH_MARKINGS.sixYard].map((box) => (
        <rect className="pitch__line" key={`${box.x}-${box.y}-${box.width}`} {...box} />
      ))}

      {starters.map((player, i) => {
        const slot = slots[i]
        if (slot === undefined) return null
        const isSelected = player.id === selected

        return (
          <g
            key={player.id}
            className={`pitch__slot${isSelected ? ' is-selected' : ''}`}
            data-position={player.position}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={label(player)}
            onClick={() => onPick(player.id)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              onPick(player.id)
            }}
          >
            {/* The native tooltip. The accessible name is the `aria-label` above:
                a `<title>` on a `<g>` is not reliably what `getByRole` computes. */}
            <title>{player.name}</title>
            <circle className="pitch__disc" cx={slot.x} cy={slot.y} r={SLOT_RADIUS} />
            <text className="pitch__ovr" x={slot.x} y={slot.y}>
              {overall(player)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
