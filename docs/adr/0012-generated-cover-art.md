# ADR 0012 — The cover is generated box art

**Status:** accepted · 2026-08-19 · **decision 1 superseded the same day, see below**
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

**1. The landing cover is a generated raster; everything else stays hand-drawn.** _(Superseded — see "What actually happened" below.)_
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
- **The share card is the one raster the name is composited into**, and decision 2
  does not forbid it. That decision is about a _model_ spelling the name, and about
  a live heading being crisper and translatable — neither applies to a flat 1200×630
  Open Graph card, which has no DOM to put a heading over. `packages/app/public/og.jpg`
  is the same cover art with the real `<h1>` rendered into it from the real
  stylesheet, so the type cannot drift from the page. See `docs/stack.md`.
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

## What actually happened — superseding decision 1

Hours after this was written the owner asked for the rest of the pixel art to be
generated too. **The hub figures, the trophy and the stadium are now painted box
art as well**, so decision 1's "everything else stays hand-drawn" is false and the
medium argument above did not survive contact. Recording what actually decided the
line, because it turned out to be sharper than "box art versus UI":

**What could not be converted, and why it is structural rather than aesthetic:**

- **`radar.ts`** plots the player's eight live attribute values as a polygon. It is
  a chart of data, not a picture of one.
- **`pitch.ts`** derives lane coordinates from the live XI across eight formations,
  and every player is a `<g role="button">` with click and Enter/Space handling. It
  is an interactive control.
- **`TileIcon.tsx`** renders at `1.35em` ≈ 18px. A generated image there is a smudge.
- **`badges.ts`** — 57 clubs at **1.25rem = 20px** in tables, ~228 on screen at once
  on the market. Generated crests were built twice and reverted twice; what the
  attempts measured is below. The drawn badges are the one piece of art in this app
  designed for its rendered size, they carry the three-letter code that stays legible
  when a mark does not, and `badges.test.ts` proves no two clubs share a
  `(colours, pattern, shape)` triple — a guarantee 57 rasters cannot offer.
  **They stay.** [ADR 0007](./0007-intellectual-property.md) is the second reason and
  would have been decisive alone: a model asked for a club badge draws something very
  close to a real crest, which is the protected category.

So the real line is not medium. It is **whether the drawing is parameterised or
interactive**. A badge takes club colours, a radar takes eight values, a pitch takes
a team sheet — those need geometry a program can address. A cover, a figure, a
trophy and a stadium tier are each drawn once and only ever selected.

**What the stadium cost, and it is a real feature, not a detail.** The ground used
to render every module it had _not_ earned yet, faded, so a small club could see
there was more to build — and the seats took the club's kit colour. A painting has
no modules to fade and no seats to recolour. Both are gone. The test that guarded
the ghosting was deleted with the behaviour rather than weakened, and says so.

**The trap the next person will hit.** The twelve stadium tiers have to read as one
ground growing. The first attempt produced a small rectangular terrace for tier 1
and a colossal oval bowl with no floodlights for tier 12 — two different buildings —
because the prompts described different architectures. A fixed architectural
skeleton repeated verbatim, with only the deck count varying, is what makes the
ladder hold. Regenerate one tier with a fresh description and the ladder breaks.

## The badges: built, and reverted

Generated crests were built in full and then reverted, on the owner's call. Recording
it because the techniques are sound and worth reusing, and because otherwise someone
will try the same thing a third time.

**What was built.** All 57 at 2rem (up from 1.25rem), generated **in sheets of nine**
and sliced apart, with the three-letter code as real HTML text on a CSS-drawn plate.
It worked: 290 crests rendered on the market screen with none broken.

**The technique worth keeping, whatever the subject.** _A single generation is what
makes a set share a style._ Generating crests one at a time drifted immediately — the
first sample grew a bird, an arrow and a range of mountains across three images.
Nine per sheet fixed it completely. The same is true of the stadium ladder, by the
same mechanism.

**Two failures, and only one was the model's:**

- **"A thick dark navy outline" leaked** out of the outlines into the fills, and a
  third of the set came back navy where it should have been red. Naming the outline
  _charcoal_, giving every colour as explicit hex, and adding "do not substitute
  navy for any other colour" fixed it in one pass.
- **Saturated red went near-black, and that was the post-processing, not the
  generation.** The chroma key's spill suppression fired on any pixel with
  `min(r, b) - g > 0`; a flat crest red (207,32,39) scores 7, so it clamped r and b
  toward g. Spill exists only on the anti-aliased fringe, so suppression is now
  restricted to partially transparent pixels. **That fix is kept** — the same bug was
  latent in the figures and the stadium and simply never fired there, because the
  agent's red tie scores exactly 0.

**What the revert restores:** `badges.ts`, `badges.test.ts`, the SVG `ClubBadge`,
`BadgeDefs` and the seventeen palette blocks — all back, and `is-sm` back to 1.25rem.
The palettes no longer name `.stadium` beside `.club-badge`: the ground is a picture
now and takes its colour from the image, so those seventeen selectors were dead.

## The stadium ladder, widened to 24

The twelve rungs were measurably badly distributed: **the entire shipped league sat
in tiers 1–7**, with Barcelona (105,000) and Madrid (83,186) sharing tier 7 despite a
22k gap, while five rungs were reserved for a 130k–200k range no club starts in. So
the two biggest grounds in the game drew as mid-sized.

**24 rungs, dense where clubs actually live** — 2k–8k apart through the real range,
widening past it. Madrid lands on 20, Barcelona on 21, the league spans 1–21, and
three rungs are left for a career that keeps building. The ladder is purely
cosmetic — `stadiumTierFor`'s only non-test caller is `EstadioScreen` — so it can be
retuned freely and can never move a calibrated band.

**Two findings, and the second is the one that will be needed again:**

- **Half the impression of size is CSS, not the drawing.** Every image is cropped to
  its own content, so at one fixed height a 200,000-seat ground rendered exactly as
  large as a 15,000-seat one; hugeness had to be inferred by counting decks. The
  height now ramps 11rem → 21rem across the rungs, via a custom property set by 24
  `[data-tier]` rules — attribute selectors rather than a JSX `style` prop, the same
  call `PlayerScreen`'s bucketed `data-fill` bars make.
- **From a fixed aerial camera, "bigger" is a ratio, not a height.** The top rungs
  first came back looking _smaller_ than the ones below: a three-quarter view from
  above hides how tall a stand is, so "more decks" did not read at all. What reads is
  how much of the footprint the pitch occupies — nearly all of it at the bottom, a
  small green rectangle inside a vast ring at the top. Naming that fraction
  explicitly in the top five prompts is what fixed them.

## The ladder again: 30 rungs, anchored at 60,000

Twenty-four rungs still drew every real club too small, and the diagnosis that fixed
it was not the one I had been working from. **The drawings were fine; the numbers
behind them were wrong.** The art ramps from a bare terrace to a colossal bowl and
the ones that read as _big_ start around rung 22 — but rung 22 meant 110,000 seats,
so Barcelona drew a ground sized for a mid-table club.

**So the capacities were remapped onto the existing drawings rather than the
drawings regenerated.** Tier 22 now means ~60,000: Heliópolis lands on the anchor,
Madrid on 24, Barcelona on 25, all three in the big-looking half, with five rungs
above Barcelona reaching 255k and open-ended. Twenty-one rungs sit below the anchor
because twenty-one of the twenty-five clubs do. **Only tiers 25–30 needed new art —
six images, not thirty.**

**The colour lesson, learned for the third time and now stated as a rule.** Adding
_any_ colour instruction to a stadium prompt swings the whole set. "Cool blue-grey"
turned four rungs blue at 12; "cool dusk lighting, no orange or terracotta tones"
turned four rungs pale blue at 30 — and that second time the note warning against it
was already sitting in `StadiumView.tsx`. **The tonal consistency comes from the
plain wording. Change architecture and scale in the prompt; never colour.**

The structural constraint needed the opposite treatment: one rung came back as an
_oval_ despite "RECTANGULAR" being in the skeleton, so that clause is now emphatic —
"STRICTLY RECTANGULAR … NOT oval, NOT round". Structure can be pushed on; colour
cannot.

**Honest limit at the top.** Tiers 25–30 differ only by the pitch shrinking inside a
deeper ring; adjacent pairs up there are subtle, which is what the plan predicted.
They are consistent and none is an outlier, and the height ramp carries the rest.

## The rungs were not in size order

Worth recording because it is a failure mode of generated art in general: **the
prompts named a deck count and the output only approximated it**, so the ladder was
scrambled. Measured across the thirty, twelve of twenty-nine steps went backwards —
the drawing at rung 21 was one of the two largest in the set, and the one generated
as "the largest imaginable" ranked twenty-fourth.

**Setting the intended size in a prompt is not the same as getting it.** A generated
ladder has to be measured and sorted afterwards, and because a rung is only a
filename, sorting is a rename — no regeneration.

**Two proxies, averaged, because each has a blind spot.** _Ring spread_ is the
footprint bounding box against the pitch bounding box, and a splayed floodlight
pylon inflates it. _Mass_ is built pixels against pitch bbox area, and a steeper
camera angle inflates it. They agree strongly at the top of the ladder and disagree
in the crowded middle; averaging their ranks is steadier than either alone, and the
result was then checked against a contact sheet by eye.

**A measurement bug worth not repeating.** The first turf detector tested
`g > r + 18`. These pitches are olive: `g − r` is 7–15 while `g − b` is 47–64, so it
rejected almost all real turf and reported 0.0% for five tiers. The working test is
`g > r + 3 && g > b + 30`, where the `g > r` clause is what keeps amber seating out.
A pitch-_area_ metric also lies where the pitch is painted in shadow — the pitch
bounding box does not.

## What finally made the stadium ladder work

Three rounds were spent measuring and re-sorting thirty drawings before anyone
counted the thing the prompts actually asked for. **The seating rings across all
thirty spanned about 1 to 2.** "Four decks", "six decks", "eight decks" were ignored
every single time; the model drew essentially one bowl and varied only the outer
facade and how deep the ring was. Sorting could never fix that, because the range was
not in the images.

**Two things had to change together:**

1. **"Decks" and "rings" are not countable instructions to this model. "Storeys of
   outer facade" is.** Probed directly: asking for 2, 5 and 9 _storeys_ produced
   unmistakably different buildings on the first attempt, where 1/3/5 _rings_
   produced three identical ones. Size is now set by facade height, laddered 1 to 15
   storeys across the thirty rungs, with roofing and corner infill varying inside
   each storey group.
2. **The camera has to be about 40° above the horizon.** The old near-overhead view
   hides vertical stacking entirely — a six-tier stand and a two-tier stand project
   almost identically, so there was neither pressure on the model to draw the
   difference nor any way for a player to see it. But dropping to ~20° went too far:
   the probes came back looking like office blocks and multi-storey car parks, with
   the pitch gone. Forty degrees keeps the whole ground and the green pitch visible
   while making wall height obvious.

**The ladder is now correct by construction rather than by permutation**, which also
means the geometric proxies used in the previous round should _not_ be re-applied.
They still disagree with it in places — built-pixel mass is sensitive to how light or
dark a given drawing came out — and trusting them over the deliberate storey ladder
is exactly the mistake that produced two rounds of futile re-sorting.

## `gradería`, and style that tracks size

The storey ladder above produced thirty grounds that were the right _sizes_ and
almost the same _building_: pale concrete, rows of arches, an outer facade — thirty
variations of one brutalist arcade. **That was a direct consequence of the prompt
wording**, in two ways. "Pale concrete stands", "rows of arches" and "outer facade"
are three ingredients, and every drawing was made of them. And the fixed
architectural skeleton repeated verbatim in all thirty — introduced deliberately, and
correctly, to stop the ladder reading as thirty unrelated buildings — made them
siblings.

All thirty were discarded and regenerated on two changes.

**1. `gradería` is the word that works.** It is the specific Spanish term for a
banked stand, and it is countable in a way "decks", "rings" and "storeys of facade"
each were not — the first two were ignored outright, the third was obeyed and
distorted the architecture into office blocks. Stated as a count and repeated
(_"tres graderías — three banked tiers of seating, one above another"_) it is
followed. "Arches" and "facade" are retired; they are what produced the arcades.

**2. Architectural style tracks size.** Six bands of five:

| tiers | graderías | character                                                        |
| ----- | --------- | ---------------------------------------------------------------- |
| 1–5   | 1         | village ground — grass banks, timber, corrugated iron, trees     |
| 6–10  | 2         | 1920s–30s town ground — red brick, gabled roofs, lattice pylons  |
| 11–15 | 3         | 1950s–60s — white concrete cantilever, elegant curves            |
| 16–20 | 4         | 1970s–80s big club — deep bowl, corner infills, concrete + steel |
| 21–25 | 5         | modern redevelopment — steel and glass, roof over every stand    |
| 26–30 | 6+        | super-stadium — translucent roof ring, sweeping form             |

That is both historically true and it turns expansion into a narrative: the club
modernises as it grows, rather than swapping one building for an unrelated one. The
cost is that crossing a band boundary changes the material in a single expansion,
which is the intended reading rather than a defect.

**The distinction that makes a varied set still look like a set: the _architecture_
varies, the _illustration_ must not.** Same painted medium, same dusk mood, same 40°
camera, same flat magenta background and same framing are fixed text in all thirty
prompts. That sentence is doing the job the architectural skeleton used to do, and it
does not cost the variety.

**Beauty was asked for explicitly** — atmospheric, characterful, handsome. None of
the earlier prompts ever asked for the drawing to be attractive, and it shows in what
they returned.

**Still no colour-temperature wording**, which has now gone wrong three times and the
rule has not changed: name a _material_, never a colour temperature.

## Named for the seats, and chosen by nearest

The ladder is finally settled. The thirty index-named files became **fifty-six named
for the capacity each picture looks like** — `6k.webp` to `200k.webp` — and a club
draws whichever name is closest to what it has.

**The sort came before the naming, and that order matters.** Every drawing was
judged by eye from contact sheets, on the one signal that survives a fixed aerial
camera: how much of the footprint the pitch takes. The geometric proxies were
deliberately not used; they are sensitive to how light or dark a drawing came out
and had already produced two rounds of futile re-sorting.

**Nearest, not a floor.** A 14,708-seat ground draws `15k`; a floor would give it
`14k` and leave every picture understating by up to a rung. **Ties go to the smaller
drawing**, so the ground never claims more than the club has — and that fires in a
real career, since Barcelona's 105,000 sits exactly between `100k` and `110k`.

**Two pairs earned a letter, and only two.** `24k`/`24ka` and `25k`/`25ka` are
genuinely interchangeable — two pale single-tier rings, two full brick rings. Five
other candidate pairs were compared close-up and rejected: same family, visibly
different colour or depth, so each kept its own number. **A letter means "these two
are the same ground", not "these two are two sizes."**

**The variant is picked from the club id**, hashed, never drawn. Something has to
choose, and eight of the twenty-five clubs sit between 21k and 25k — exactly where
the variants are — so without it they would all draw the same picture. It is also
the only reason every file on disk is used.

**The scale ramp went logarithmic in seats.** The rungs are dense at the bottom and
sparse at the top because that is where the art is, so a straight ramp over the rung
index would have made 100k→110k the same visual jump as 24k→25k.

**What the rename bought in the tests** is a stronger guard than the one it
replaced: `art.test.ts` used to assert the directory held exactly `TOP_TIER` files,
which a stray file and a stray declaration could cancel out between them. It is set
equality now, and it catches either alone.
