import { describe, it, expect } from 'vitest'
import { getTextDirection } from '../../src/utils/textDirection'

describe('getTextDirection utility', () => {
  it('detects Persian text as rtl', () => {
    expect(getTextDirection('سلام دنیا')).toBe('rtl')
    expect(getTextDirection('این یک پیام آزمایشی به زبان فارسی است')).toBe('rtl')
    expect(getTextDirection('پژگچ (حروف اختصاصی فارسی)')).toBe('rtl')
  })

  it('detects English/Latin text as ltr', () => {
    expect(getTextDirection('Hello World')).toBe('ltr')
    expect(getTextDirection('This is an AI response rendered in English.')).toBe('ltr')
    expect(getTextDirection('const x = 42;')).toBe('ltr')
  })

  it('correctly handles Markdown formatted text', () => {
    // Markdown lists and formatting in Persian
    expect(getTextDirection('- سلام، چطور می‌توانم کمک کنم؟')).toBe('rtl')
    expect(getTextDirection('1. مورد اول')).toBe('rtl')
    expect(getTextDirection('**سلام دوستان**')).toBe('rtl')
    expect(getTextDirection('> یک نقل قول فارسی')).toBe('rtl')

    // Markdown lists and formatting in English
    expect(getTextDirection('- Hello, how can I help you today?')).toBe('ltr')
    expect(getTextDirection('1. First item')).toBe('ltr')
    expect(getTextDirection('**Bold Title**')).toBe('ltr')
    expect(getTextDirection('> A blockquote in English')).toBe('ltr')
    expect(getTextDirection('```json\n{"status": "ok"}\n```')).toBe('ltr')
  })

  it('determines direction by first strong character in mixed text', () => {
    expect(getTextDirection('سلام Hello')).toBe('rtl')
    expect(getTextDirection('Hello سلام')).toBe('ltr')
  })

  it('handles empty, null, undefined, or neutral inputs using fallback', () => {
    expect(getTextDirection('')).toBe('rtl')
    expect(getTextDirection(null)).toBe('rtl')
    expect(getTextDirection(undefined)).toBe('rtl')
    expect(getTextDirection('', 'ltr')).toBe('ltr')
    expect(getTextDirection('123456', 'ltr')).toBe('ltr')
    expect(getTextDirection('...', 'rtl')).toBe('rtl')
  })
})

