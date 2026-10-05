# ADR 0020 — Releases are tagged, and only releases deploy

**Status:** accepted · 2026-10-05

## Context

Every push to `main` deployed the site. Docs, tests and process changes merge to `main` as
well, so most deploys republished the same game with a new commit hash in the footer.
Shipping was a side effect of merging, nobody chose when players got a change, and there
was no record of what changed for them: no versions, no tags, no releases, and a "What's
new" in the README that had fallen two months behind. A flaky test on `main` also held
back a real change (the first phone layout) without anyone noticing, because a skipped
deploy looks like a quiet day.

## Decision

1. **Merging checks; releasing deploys.** A push to `main` and every pull request run the
   `check` job only. Publishing a GitHub release runs `check` again on its commit and then
   deploys. A manual run of the workflow from a release tag redeploys that release.
2. **A release is a `v` tag with three numbers and its notes,** created together by
   `gh release create vX.Y.Z --target main --notes-file …`. Notes are written for players,
   not as a list of commits.
3. **Versions are `0.x.y` until the game reaches its 2001 target (M7).** The minor number
   moves for a batch players would notice; the patch number for fixes. The tag is the
   version: the root `package.json` stays `0.0.0`, because the package is private and a
   second copy of the number is one that can disagree.
4. **The footer shows the version** on a release build (`RELEASE_TAG`, read by
   `commit.ts`), and the commit on any other build.
5. **The `github-pages` environment allows `main` and `v*` tags,** since the deploy now runs
   from a tag.
6. **GitHub Releases are the changelog.** The README's "What's new" keeps the latest
   release in a few lines and links to the rest.

## Consequences

- A fix reaches players only once it is released: one command, made on purpose.
- Merged work can sit unreleased. Releasing is a habit to keep, and a `release` skill is
  the follow-up that makes it one command and keeps the notes in players' words.
- A release whose `check` fails is published but not deployed. Fix forward with the next
  patch version rather than moving a tag that is already public.
