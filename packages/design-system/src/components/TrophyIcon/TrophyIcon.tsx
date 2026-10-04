import './TrophyIcon.css'

/**
 * One trophy, on the palmarés honours panel.
 *
 * **Generated box art rather than a pixel grid — see [ADR 0012].** It was a 16x20
 * character grid, and the handles were the hard part: attached at both ends with a
 * pixel of daylight through the middle, because a handle fixed only at the rim
 * reads as a wing. A painting has no such problem, which is most of why this one
 * was the cleanest swap in the app — one image, no parameterisation, no states.
 *
 * Cut out against alpha the same way the hub figures are, so it sits on the panel
 * rather than in a box of its own.
 *
 * **A generic invented cup, not a real competition's trophy.** [ADR 0007] puts
 * artwork and emblems on the protected side, and a trophy is a competition's
 * emblem as much as a crest is a club's. That constraint outlived the pixel
 * version and applies to the prompt just as it applied to the grid.
 *
 * `empty` dims a competition nobody has won yet rather than hiding it, so the
 * palmarés shows the shape of what is winnable from the first day of a career.
 *
 * **`aria-hidden` is load-bearing**: this sits beside the competition's name in
 * real text, so the graphic has nothing to add and would only pollute whatever
 * later wraps it.
 */
export function TrophyIcon({
  trophy,
  src,
  empty = false,
}: {
  /** Which competition, for `data-trophy`. The game's are listed in the app. */
  readonly trophy: string
  /** Where the cut-out image is served from. */
  readonly src: string
  readonly empty?: boolean
}) {
  return (
    <img
      className={`trophy${empty ? ' is-empty' : ''}`}
      data-trophy={trophy}
      src={src}
      alt=""
      aria-hidden="true"
    />
  )
}
