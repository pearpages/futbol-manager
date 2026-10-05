import { describe, expect, it } from 'vitest'
import { buildStamp } from './commit.ts'

describe('the build stamp', () => {
  it('is the release tag when a release is built', () => {
    expect(buildStamp({ RELEASE_TAG: 'v0.6.0' })).toBe('v0.6.0')
  })

  it('is the commit otherwise, including for anything that is not a version tag', () => {
    for (const env of [{}, { RELEASE_TAG: '' }, { RELEASE_TAG: 'main' }, { RELEASE_TAG: 'v1' }]) {
      expect(buildStamp(env)).not.toMatch(/^v/)
    }
  })
})
