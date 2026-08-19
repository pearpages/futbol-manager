# ADR 0012 — The cover is generated box art

**Status:** accepted · 2026-08-19
**Relates to:** [ADR 0007](./0007-intellectual-property.md), [ADR 0008](./0008-target-pc-futbol-5.md)

## Context

Every drawing in this app is hand-authored: a character grid or a set of
coordinates in a `.ts` file, decoded to SVG `<rect>`s or `<polygon>`s, with colour
in a matching `.css` file. `badges.ts`, `radar.ts`, `sprites.ts`, `trophies.ts`,
`stadium.ts` and `pitch.ts` all follow it, and tests enforce the split by refusing
a hex literal in the TypeScript. Until today the repo also had a property worth
naming: **no binary asset was tracked anywhere** — not one image, font or favicon.
That was already retracted once, for `pearpages-icon.png`, which is a network
credit whose whole point is being the same mark as in five sibling projects.

The landing cover was drawn the same way — a 161 × 91 grid, 14,651 pixels — and it
was rejected on sight. The diagnosis was not that pixel art was the wrong medium;
it was that the drawing was bad, and measurably so:

- Its own test capped it under 1,800 rects. It shipped 1,401, an average run of
  **10.5 px** — long flat bands by construction. The stadium art runs **1.9–3.7**.
  It was the least detailed art in the project because of a budget I wrote.
- The manager was a constant-width block of one flat `#070b18` from row 58 to the
  bottom edge: no taper, no arms, no coat, no value steps.
- A fifth of the canvas was flat fill under the wordmark, the crowd was uniform
  speckle, and the floodlights lit nothing.

The owner's instruction was to have an image model draw it instead, as painted 90s
CD-ROM box art, keeping the manager-on-the-touchline subject.

## Decision

**1. The landing cover is a generated raster; everything else stays hand-drawn.**
`packages/app/public/cover.webp`, 1344 × 768, 197 KB at q86. The in-app art — hub
figures, badges, stadium, trophies, radar, pitch — is untouched and the convention
that governs it is unchanged.

The line is medium, not quality. **Box art was never the same medium as the UI it
fronts**: PC Fútbol's own covers were painted and photographic while its screens
were pixels, and reproducing that split is more faithful to [ADR 0008](./0008-target-pc-futbol-5.md)
than making the cover match the chrome. A cover is also drawn once and never
parameterised, where every in-app drawing is: a badge takes club colours, a stadium
takes a tier and a palette, a figure takes a hover state. Those need geometry a
program can address. This does not.

**2. No lettering is generated into the image.** The name is a real `<h1>` over the
picture. Image models spell badly and the exact string was specified; real text is
also crisper at any size, translatable, and announced to assistive technology
exactly once. The image is decorative — empty `alt`, `aria-hidden` — like every
other drawing here. The composition was chosen with an open top-right corner for
it to sit in, and a container query keeps it a constant fraction of the art.

**3. The name loses its accent: `Futbol Manager`, not `Fútbol Manager`.** One key,
`shell.wordmark`, feeds the cover, the shell bar and the browser tab, so one
spelling reaches all three. Comments referring to the real _PC Fútbol_ keep theirs;
that is a different product's name.

**4. The generated PNG is not committed — only the WebP that ships.** Conversion is
`cwebp`, a tool already on the machine, so no project dependency and nothing new to
pin in `stack.md`.

## Consequences

- **A second binary asset, and the "no binaries" property is now properly gone.**
  It was true until `pearpages-icon.png`; it is now retired rather than eroded.
  Both are in `public/`, both are decoration, and neither is game state.
- **The cover cannot be iterated precisely.** A hand-authored grid can be nudged a
  pixel at a time; this can only be regenerated. Accepted, because a cover is not
  something that gets nudged.
- **Reversal is cheap and stays cheap.** One file in `public/`, one `<img>`, one
  block of CSS. The pixel-art technique is intact in five other modules if it is
  ever wanted back here.
- **The old cover's guards are gone with it** — 15 tests describing a grid that no
  longer exists. What replaces them: the asset exists and is inside a first-paint
  budget, the wordmark is visible rather than `visually-hidden`, the image carries
  an empty `alt`, and the name has no accent in any of the three languages.

## On intellectual property

[ADR 0007](./0007-intellectual-property.md) is about not taking Dinamic's assets
and not taking club identity. Neither is engaged here: the image is generated
rather than copied, and it was prompted explicitly for a **generic fictional club
with no real crest, kit, badge or recognisable person**, then checked. The kit
colours in the crowd are invented, the stadium is invented, and the manager is
nobody. Google grants the output to the caller under the Gemini API terms.

The prompt also asked for **no text, no logos, no signature** — partly for the
wordmark reason above, and partly because a model-hallucinated mark or signature in
a shipped asset would be exactly the kind of thing ADR 0007 exists to keep out.
Every candidate was looked at before one was chosen.
