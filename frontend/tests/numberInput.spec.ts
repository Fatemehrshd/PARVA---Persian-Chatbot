import { describe, expect, it } from 'vitest'
import { normalizeNumericInput } from '../src/utils/numberInput'

describe('normalizeNumericInput', () => {
  it('accepts Persian and Arabic digits with decimal separators', () => {
    expect(normalizeNumericInput('۱۲۳۴٫۵۶')).toBe('1234.56')
    expect(normalizeNumericInput('١٬٢٣٤,٥')).toBe('1234.5')
  })

  it('preserves a blank value and removes unsupported characters', () => {
    expect(normalizeNumericInput('')).toBe('')
    expect(normalizeNumericInput('۱۲abc۳')).toBe('123')
  })
})
