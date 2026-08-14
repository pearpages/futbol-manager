/**
 * Writes a fixture save for the schema version this build currently ships.
 *
 *   pnpm fixture
 *
 * ADR 0005 requires a committed save per shipped version, and a round-trip test
 * against it — the point being that a migration is exercised against data an
 * *older* build actually wrote, not data invented by the same commit as the
 * migration. Until now those files were produced ad hoc, which is why there is a
 * `v1.json` and a `v3.json` and nothing else.
 *
 * **Run this before adding the next migration, never after.** The version stamped
 * on the envelope is read from the live chain, so once `v4ToV5` is in
 * `MIGRATIONS` this script can only ever write a v5 file and the v4 fixture
 * becomes unobtainable short of a checkout.
 *
 * Imports reach into package sources by relative path, for the reason recorded in
 * `season.ts`. `migrations.ts` is imported directly rather than through
 * `persistence/index.ts`, which would drag in `store.ts` and its IndexedDB
 * dependency for a script that only needs a version number.
 */
import { writeFileSync } from 'node:fs'
import { createRng, newSeason, reduce } from '../packages/domain/src/index.ts'
import { DEFAULT_CLUBS } from '../packages/data/src/clubs.ts'
import { PLAYER_NAMES } from '../packages/data/src/names.ts'
import { SCHEMA_VERSION } from '../packages/persistence/src/migrations.ts'

/** Far enough in that results, the day clock and the rng cursor have all moved. */
const DAYS = 100
const SEED = 20260814

const rng = createRng(SEED)
let state = newSeason(DEFAULT_CLUBS, 2026, { names: PLAYER_NAMES, rng })
for (let day = 0; day < DAYS; day++) state = reduce(state, { type: 'AdvanceDay' }, rng).state

const envelope = { schemaVersion: SCHEMA_VERSION, rngState: rng.state(), payload: state }
const path = new URL(
  `../packages/persistence/src/fixtures/v${SCHEMA_VERSION}.json`,
  import.meta.url,
)

writeFileSync(path, `${JSON.stringify(envelope, null, 2)}\n`)

const played = state.season.fixtures.filter((f) => f.result !== null).length
console.log(`Wrote v${SCHEMA_VERSION}.json — ${DAYS} days in, ${played} fixtures played.`)
