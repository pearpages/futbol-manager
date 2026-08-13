import { describe, expect, it } from 'vitest'
import { createRng } from '@fm/domain'
import { SCHEMA_VERSION, wrapSave } from './index.js'

describe('@fm/persistence', () => {
  it('stamps every save with a schema version', () => {
    expect(wrapSave({ clubs: [] }, createRng(1).state()).schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('carries RNG state through a JSON round-trip so a reload resumes the stream', () => {
    const rng = createRng(2026)
    for (let i = 0; i < 100; i++) rng.next()

    const saved = JSON.parse(JSON.stringify(wrapSave({ day: 42 }, rng.state()))) as ReturnType<
      typeof wrapSave<{ day: number }>
    >

    expect(createRng(saved.rngState).next()).toBe(rng.next())
  })
})
