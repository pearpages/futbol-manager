# ADR 0026 — Visits are counted by footfall

**Status:** accepted · 2026-10-06

## Context

The game shipped with no analytics, and the README and security.md said so: nothing leaves
the player's device. That leaves the owner blind to whether anyone plays, on what screen
size, in which language, or whether a release changed anything. Those are the questions the
mobile-first work (ADR 0022) and the three languages are built on.

The owner runs footfall, one self-hosted Umami instance at `analytics.pearpages.com`, for
all of their sites. It sets no cookie, stores nothing on the device and sends nothing to a
third party. That falls under the AEPD's audience-measurement exemption, so no consent banner
is needed.

The alternatives were to keep counting nothing, or to use a hosted product (Google
Analytics, Plausible's cloud), which would put a third party on the page and, for GA, need a
consent banner.

## Decision

1. **The page loads footfall's script**, one `defer` tag before `</head>` in
   `packages/app/index.html` with this site's website ID. Nothing else: no events, no user
   identifiers, no other tracker.
2. **It counts visits, never the game.** No save, career, club or command is sent. The
   tracker sees page views only, and the game has one URL, so it counts loads of the game.
3. **The docs say what is sent.** The README tells players that visits are counted
   anonymously, without cookies, on the owner's server. security.md lists
   `analytics.pearpages.com` as the one outside origin the page trusts, and the planned CSP
   allows it for `script-src` and `connect-src`.

## Consequences

- The owner can see visits, screen sizes, languages and referrers, per release.
- "Nothing leaves your device" is no longer true of the page, only of the game's data, and
  the README now says exactly that.
- The page trusts one more origin: if `analytics.pearpages.com` were compromised it could run
  script here. The CSP item limits it to that origin.
- Storybook is not counted. Only the game is.
