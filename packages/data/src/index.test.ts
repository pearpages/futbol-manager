import { describe, expect, it } from 'vitest'
import { createRng } from '@fm/domain'
import { rngFromDatasetSeed } from './index.js'

describe('@fm/data', () => {
  it('resolves @fm/domain across the workspace', () => {
    // Proves the pnpm workspace link and the TS path resolution, not the logic.
    expect(rngFromDatasetSeed(5).next()).toBe(createRng(5).next())
  })
})
