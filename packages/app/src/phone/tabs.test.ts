import { describe, expect, it } from 'vitest'
import type { Screen } from '../store.ts'
import { TABS, tabOf } from './tabs.ts'

const ALL: readonly Screen[] = [
  'hub',
  'table',
  'results',
  'calendar',
  'squad',
  'lineup',
  'market',
  'player',
  'caja',
  'decisiones',
  'estadio',
]

describe('the phone tabs', () => {
  it('hold every screen but the player page exactly once', () => {
    const held = TABS.flatMap((entry) => entry.screens)
    expect([...held].sort()).toEqual(ALL.filter((s) => s !== 'player').sort())
  })

  it('put a player page in the tab it was opened from', () => {
    expect(tabOf('player', 'market')).toBe('market')
    expect(tabOf('player', 'squad')).toBe('team')
    expect(tabOf('caja', 'squad')).toBe('club')
  })
})
