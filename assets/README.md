# assets/ — visual reference, not source

Screenshots of **PC Fútbol 5.0** (Dinamic Multimedia, 1996/97), kept locally to design against. This README is the only file in here that is tracked; everything else is gitignored and must stay that way.

## The rules

**Nothing in this folder is committed.** `.gitignore` carries `assets/*` with an exception for this file. If you find yourself wanting to `git add -f` an image, the answer is no — keeping these out of the repository is the difference between studying published work and redistributing it.

**Study the idiom; do not reproduce the screens.** Per [ADR 0007](../docs/adr/0007-intellectual-property.md), the material language is not ownable — raised bevelled panels holding controls, data sunk into recessed screens, condensed uppercase labels, dense tables. That vocabulary was shared by every Windows 95 application and is what this project builds in. Their specific layouts, icons and artwork are protected, and are not to be reproduced, traced over, or redrawn closely enough to be recognised as copies.

**Nothing here ships.** No image in this folder becomes a sprite, a texture, a background, or a colour picked with an eyedropper straight off a screenshot.

## What to look at

The first delivery targets 5.0 rather than 2001 — see [ADR 0008](../docs/adr/0008-target-pc-futbol-5.md). What is useful here is the **management** screens: the classification table, the player card, squad lists, the transfer screens, and the surrounding menu chrome. 5.0's 3D match view is not something this project has or wants.

The questions worth asking of these images are about **information design**, not decoration: how much data fits on one screen, what earns a colour, how a table is made readable at twenty rows, where the eye is meant to land first.

## Where they came from

Publicly published screenshots from retro-gaming archives and databases — Computer Emuzone, DeVuego, LaunchBox Games Database, the Internet Archive and Wikipedia. If you refresh this folder, prefer those; avoid sites whose terms prohibit automated collection.
