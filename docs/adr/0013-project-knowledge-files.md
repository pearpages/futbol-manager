# ADR 0013 — Project knowledge lives in principles, architecture, decisions, tasks and security

**Status:** accepted · 2026-10-02

## Context

Agents and people need to find how to work here, the rules, how it is built, why choices
were made, what is open and what the risks are. In this project that knowledge piled up in
`CLAUDE.md`: by October 2026 it held about 2,600 lines, and about 2,550 of them were a session
log with 82 dated entries. The ground rules and conventions sat at the top, and the open items
and hard-won pitfalls were scattered through the entries. That made them hard to find and
impossible to prune. Other agents never loaded that file at all.

## Decision

1. `AGENTS.md` holds how to work here, the commands, the pitfalls, and pointers. Nothing
   else. `CLAUDE.md` only imports `AGENTS.md` and `principles.md`, so Claude Code always loads
   the rules. Other agents read `AGENTS.md` and follow its links.
2. `principles.md` holds the rules every change follows, including the ground rules.
   `architecture.md` says how it is built. `decisions.md` + `docs/adr/` say why. `tasks.md`
   holds Open / Done. `security.md` covers the threat surface, secrets, dependencies and
   reporting. `README.md` is for users.
3. The model references in `docs/` (`roadmap.md`, `stack.md`, `attribute-model.md`,
   `market-model.md`) stay where they are. A finding about the model goes into the one it
   belongs to, not into a log.

## Consequences

- Every kind of knowledge has one home, and any agent finds it from `AGENTS.md`.
- The principles are always in Claude's context without being duplicated.
- The session log's narrative of _how_ each conclusion was reached stops growing. Git, PRs
  and the docs it fed become the history.
- There are more files to keep current. The working rules in `AGENTS.md` make updating them
  part of every change.
