# ADR 0007 — Intellectual property: copy the design, not the expression

**Status:** accepted · 2026-08-14

## Context

This project is explicitly "a PC Fútbol 2001-style football management game", and several conventions already assert a legal position without recording one. [`CLAUDE.md`](../../CLAUDE.md) says _"a city name is not a club trademark; real club names stay a user-supplied import"_; the roadmap says the game _"ships with unlicensed city names by default"_. Neither says why, and the question came up in the obvious form: PC Fútbol is old and Dinamic is gone — can we just copy it?

**The premise is wrong, and it was checked rather than assumed.**

Dinamic Multimedia filed for bankruptcy in **September 2001**, but intellectual property is an asset sold in liquidation, not something that lapses when a company folds. The chain of title is public: **Planeta DeAgostini** bought the PC Fútbol rights in **2004** and assigned development to **Gaelco Multimedia**; Gaelco went bankrupt in **2007**, citing the cost of official league licences; the rights passed to **Gamick** (formerly On Games); today they are held by **Héctor Prats**, and **PC Fútbol 8** is on Steam. The brand is live, owned and commercially active. "Abandonware" is a community norm with no standing in law.

Nor has copyright run out. A 1996 work authored by a legal person is protected for roughly **70 years from lawful disclosure** under Spanish and EU law — into the 2060s.

What makes this tractable is that **copyright protects expression, not ideas**. Game mechanics, rules and systems are not protected subject matter. The CJEU has said so for software specifically in **_SAS Institute v World Programming_ (C-406/10, 2012)**: a program's functionality, its programming language and its data file formats are not protected by copyright. A graphical user interface is not part of the program's protected expression either, though it may be protected as a work in its own right where it is original — **_Bezpečnostní softwarová asociace_ (C-393/09, 2010)**.

One further point matters more than any of the above. **The larger exposure was never Dinamic's to give.** Club names and crests, kit designs, and real players' names and likenesses belong to the clubs, the league and the players. Dinamic _licensed_ them; Gaelco's stated reason for closing was that it could no longer afford to. Anyone reasoning "the original game had Real Madrid in it, so we can" has the chain of title backwards.

## Decision

**1. Copy the design, boldly and deliberately.** Mechanics, systems and structure are not protected, and this project takes them on purpose: day-level ticks, the ficha as the central player view, a small weighted attribute model, statistically resolved results rather than a match engine, a transfer market driven by squad need, a table-heavy screen architecture. That is most of what makes the genre what it is, and none of it is anyone's property.

**2. Never the name, never the assets.** "PC Fútbol" and "Dinamic" do not appear in the product, its branding, its package names, its repository name or a domain. No original code, artwork, sprites, fonts, audio or data is incorporated, in any form, including as a reference to trace over.

**3. The look is an original design in the same idiom.** Raised bevelled panels holding controls, with data sunk into recessed screens, is a _material language_ of mid-nineties Windows software — not ownable, and shared with every application of its era. Their particular layouts, icons and artwork are protected. The line: our screens must not be recognisable as reproductions of theirs. Designing in the idiom is the point; redrawing their screens is not.

**4. Default content is fictional.** Clubs are named for their city, a city's second club for its district or ground, and players are generated from Spanish given-name and surname pools. This is the constraint that actually carries risk, and it exists because club and player identity belongs to third parties who have nothing to do with Dinamic. It is not a stylistic preference and should not be relaxed for convenience.

### Deliberately left open

**What the data layer may _ship_ is not decided here.** The roadmap assumes real names arrive as a user-supplied import, but the difference between shipping a _format_ — an importer that reads a file the user provides — and shipping _data_ is a real decision with real consequences, and it belongs with M3's data-pipeline work rather than being settled in passing.

One known wrinkle for whoever picks it up: the roadmap names **openfootball** as a source for club and league structure. openfootball is **ODbL**, a share-alike database licence. Bundling it is not free of obligation — attribution and copyleft terms would attach to our data layer, which is a licensing decision in its own right and not merely a sourcing one.

## Consequences

- The naming conventions in `CLAUDE.md` and the roadmap now have a reason recorded behind them, and can be defended rather than merely followed.
- **The current visual direction is safe as it stands** and requires no change. Pushing the period look further is a taste-and-effort decision, not a legal one — it stops at reproducing their screens, not before.
- The reasoning survives the question being asked again. It will be: the game invites the comparison on purpose.
- This is a considered engineering position, **not legal advice**. A commercial release would want a real review, particularly on trademark, and most particularly if any marketing invokes the original by name.

## Sources

- [Xataka — La maldición de PC Fútbol](https://www.xataka.com/videojuegos/maldicion-pc-futbol-videojuego-que-ha-hundido-a-quien-ha-intentado-resucitarlo-1999)
- [Wikipedia — Dinamic Multimedia](https://en.wikipedia.org/wiki/Dinamic_Multimedia)
- [Wikipedia — PC Fútbol](https://en.wikipedia.org/wiki/PC_F%C3%BAtbol)
- [PC Fútbol 8 on Steam](https://store.steampowered.com/app/2336170/PC_Futbol_8/)
