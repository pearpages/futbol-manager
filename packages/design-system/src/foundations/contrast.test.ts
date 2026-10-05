import { describe, expect, it } from 'vitest'
import { contrast } from './contrast.ts'

describe('contrast', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast('#000', '#fff')).toBeCloseTo(21, 1)
    expect(contrast('#fff', '#fff')).toBeCloseTo(1, 5)
    // The pair the contrast pass fixed: ink-soft on the panel.
    expect(contrast('#454b41', '#b9bfae')).toBeCloseTo(4.76, 1)
  })
})
