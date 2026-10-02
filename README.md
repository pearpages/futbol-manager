# Futbol Manager

A football management game for the browser, in the style of Dinamic's PC Fútbol 5.0
(1996/97).

You take charge of a first-division club, pick the eleven and the system, buy and sell in the
transfer windows, set ticket prices, expand the stadium and keep the board happy. Matches are
worked out statistically, not animated. The game is fictional by default: clubs are named after
their cities, and it ships in Catalan, Spanish and English.

**Play it:** <https://futbol.pearpages.com>. Careers are saved in your browser and nothing
leaves your device.

## Install

Requires [mise](https://mise.jdx.dev), which pins Node 24.16.0 and pnpm 11.15.0.

```sh
mise trust && mise install && pnpm install
```

## Usage

```sh
pnpm dev               # the game on a local dev server
pnpm test -- --run     # the full test suite, once
pnpm season 42         # simulate a season headless and print the final table
pnpm build             # production bundle in packages/app/dist
```

## Documentation

- [docs/roadmap.md](docs/roadmap.md): milestones, what is built and what comes next
- [architecture.md](architecture.md): how the game is put together
- [docs/attribute-model.md](docs/attribute-model.md) and [docs/market-model.md](docs/market-model.md):
  how players are rated and valued
- [decisions.md](decisions.md): why things are the way they are

Contributors and agents start at [AGENTS.md](AGENTS.md).

## License

Proprietary, all rights reserved. The source is published for viewing only. See [LICENSE](LICENSE).
