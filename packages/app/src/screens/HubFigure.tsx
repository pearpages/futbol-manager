import '../styles/hub-figures.css'

/** The four people, one per hub quadrant. Also the filenames under `public/art`. */
export const FIGURE_KEYS = ['assistant', 'trainer', 'agent', 'director'] as const

export type FigureKey = (typeof FIGURE_KEYS)[number]

/**
 * One painted figure, at the foot of its quadrant.
 *
 * **Generated box art rather than a pixel grid — see [ADR 0012].** These were four
 * 28x32 character grids decoded to SVG rects, with four prop animations and a
 * hover smile driven by `data-part` groups. All of that went with them: a painting
 * is one image and cannot animate a clipboard without animating the man holding
 * it. What is kept is the slot — same quadrant, same 8rem, same layout.
 *
 * **Cut out against alpha, not pasted on a background.** Each was generated on a
 * flat magenta backdrop and keyed on `min(r, b) - g`, which isolates magenta
 * specifically: pure red scores zero, so the agent's tie survives where the naive
 * "red and blue are both high" test erases it. Then cropped to the largest
 * connected blob — the generations carry a detached grey wisp in one corner that
 * is solid enough to pass any alpha threshold, and cropping to every solid pixel
 * shoved the subject off centre with dead space beside it.
 *
 * **`aria-hidden` is load-bearing, not politeness.** Two dozen assertions across
 * five test files find a hub tile by its exact accessible name, and `openScreen`
 * matches the whole string. A figure sits inside the `<section>` rather than
 * inside a `<button>`, so it could not rename a tile — but it *would* land in the
 * accessible name of anything that later wrapped it, and it says nothing a screen
 * reader wants. Same precedent as `TileIcon` and the market's sort arrows. The
 * empty `alt` goes with it: without one, a screen reader reads the file name.
 */
export function HubFigure({ figure }: { readonly figure: FigureKey }) {
  return (
    <img
      className="hub-figure"
      data-figure={figure}
      src={`/art/${figure}.webp`}
      alt=""
      aria-hidden="true"
    />
  )
}
