import { describe, it, expect } from 'vitest'
import { markDefaultModel } from '../src/utils/models'

describe('markDefaultModel', () => {
  it('moves the default flag and returns the previous id', () => {
    const models = [
      { id: 'a', isDefault: true },
      { id: 'b', isDefault: false },
    ]
    expect(markDefaultModel(models, 'b')).toBe('a')
    expect(models).toEqual([
      { id: 'a', isDefault: false },
      { id: 'b', isDefault: true },
    ])
  })

  it('supports rollback by re-marking the previous id', () => {
    const models = [
      { id: 'a', isDefault: false },
      { id: 'b', isDefault: true },
    ]
    const prev = markDefaultModel(models, 'a')
    markDefaultModel(models, prev ?? '')
    expect(models.find((m) => m.id === 'b')?.isDefault).toBe(true)
    expect(models.find((m) => m.id === 'a')?.isDefault).toBe(false)
  })

  it('returns undefined when nothing was default', () => {
    const models = [{ id: 'a' }, { id: 'b' }]
    expect(markDefaultModel(models, 'a')).toBeUndefined()
    expect(models[0].isDefault).toBe(true)
  })
})
