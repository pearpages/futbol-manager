import { describe, expect, it } from 'vitest'
import * as bundle from './bundle.ts'

describe('the bundle entry', () => {
  it('carries React and createRoot, so a page with no module loader can mount components', () => {
    expect(typeof bundle.React.createElement).toBe('function')
    expect(typeof bundle.createRoot).toBe('function')
  })
})
