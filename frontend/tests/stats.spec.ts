import { describe, it, expect } from 'vitest'
import { adjustStat } from '../src/utils/stats'

describe('adjustStat', () => {
  it('adds positive and negative deltas to numeric counters', () => {
    const stats: Record<string, unknown> = { activeModels: 3 }
    adjustStat(stats, 'activeModels', -1)
    expect(stats.activeModels).toBe(2)
    adjustStat(stats, 'activeModels', 1)
    expect(stats.activeModels).toBe(3)
  })

  it('ignores null stats, missing keys and non-numeric values', () => {
    expect(() => adjustStat(null, 'x', 1)).not.toThrow()
    expect(() => adjustStat(undefined, 'x', 1)).not.toThrow()
    const stats: Record<string, unknown> = { name: 'dash', count: NaN }
    adjustStat(stats, 'missing', 1)
    adjustStat(stats, 'name', 1)
    adjustStat(stats, 'count', 1)
    expect(stats).toEqual({ name: 'dash', count: NaN })
  })
})
