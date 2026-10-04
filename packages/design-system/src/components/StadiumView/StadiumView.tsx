import './StadiumView.css'

/**
 * The ground you have built.
 *
 * **Painted box art rather than a pixel grid — see [ADR 0012].** It was two views
 * (a plan and a section) assembled from disjoint modules, where an unbuilt module
 * rendered ghosted so the screen showed what you could still buy, and the seats
 * took the club's kit colour through `--badge-a`. **Both of those went with the
 * grid**: a painting is one image, so there is no module to fade and no seat to
 * recolour. What is kept is the thing the screen is actually for — fifty-six
 * drawings, and yours changes when you expand.
 *
 * **They have to be one ground growing, not fifty-six grounds**, which is the whole
 * risk in generating them. What holds the set together is that the *illustration*
 * is fixed — same painted medium, same dusk mood, same 40-degree camera, same
 * framing — while the architecture varies with size, from a village pitch with
 * grass banks to an enclosed super-stadium. Regenerate one and reuse that wording.
 * Do not add colour-temperature wording either: it has swung the whole set three
 * separate times, most recently turning four rungs pale blue.
 *
 * **From a fixed aerial camera, "bigger" is a ratio, not a height.** A
 * three-quarter view from above hides how tall a stand is, so more decks simply do
 * not read. What reads is how much of the footprint the pitch takes: a small ground
 * is nearly all pitch, and a 200,000-seat one is a small green rectangle inside a
 * vast ring. That is also the signal the drawings were sorted by.
 *
 * **Half the impression of size is CSS, not the drawing.** Every image is cropped
 * to its own content, so at one fixed height a 200,000-seat ground rendered exactly
 * as large as a 15,000-seat one — see the scale ramp in `stadium.css`.
 *
 * **`aria-hidden` is load-bearing, not politeness.** The capacity this describes
 * is stated as a number a few centimetres away in the same panel, so it has
 * nothing to add and would only pollute whatever later wraps it. Same precedent
 * as `TileIcon`, `HubFigure` and `TrophyIcon` — and, being decoration, it is why
 * the whole feature needs no dictionary key in any of the three languages.
 */
export function StadiumView({
  src,
  seats,
}: {
  /** The drawing to show. */
  readonly src: string
  /** The capacity rung, for `data-seats`, which sets the drawing's scale. */
  readonly seats: string
}) {
  return (
    <img
      className="stadium"
      /* The rung, not the file: a variant is the same size as its base, so the two
         share a scale. */
      data-seats={seats}
      src={src}
      alt=""
      aria-hidden="true"
    />
  )
}
