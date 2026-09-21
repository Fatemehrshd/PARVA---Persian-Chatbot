import { describe, it, expect } from 'vitest'
import { getTextDirection, getActiveTypingDirection, getLineDirection } from '../../src/utils/textDirection'

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

describe('getActiveTypingDirection utility (hybrid real-time input direction)', () => {
  it('defaults to rtl for empty or whitespace text', () => {
    expect(getActiveTypingDirection('')).toBe('rtl')
    expect(getActiveTypingDirection('   ')).toBe('rtl')
    expect(getActiveTypingDirection(null)).toBe('rtl')
    expect(getActiveTypingDirection(undefined)).toBe('rtl')
  })

  it('correctly sets direction to ltr for pure English and rtl whenever Persian is present (mixed or pure)', () => {
    // 1. User types English: "H" -> goes left (ltr)
    expect(getActiveTypingDirection('H', 1)).toBe('ltr')
    // User types "Hello " -> stays left (ltr)
    expect(getActiveTypingDirection('Hello ', 6)).toBe('ltr')

    // 2. User then types Persian character: "س" -> flips right (rtl)
    expect(getActiveTypingDirection('Hello س', 7)).toBe('rtl')
    // User types "Hello سلام " -> stays right (rtl)
    expect(getActiveTypingDirection('Hello سلام ', 11)).toBe('rtl')

    // 3. User then types English word alongside Persian -> MUST stay right (rtl) per rule
    expect(getActiveTypingDirection('Hello سلام w', 12)).toBe('rtl')
    expect(getActiveTypingDirection('Hello سلام world', 16)).toBe('rtl')

    // 4. Persian mixed with English code/terms
    expect(getActiveTypingDirection('این ارور چیه: TypeError: undefined', 30)).toBe('rtl')
    expect(getActiveTypingDirection('React یک کتابخانه جاوااسکریپت است', 15)).toBe('rtl')
  })

  it('keeps rtl direction when multi-line text contains Persian', () => {
    const text = 'Line one in English\nخط دوم به فارسی\nLine three in English'

    // Contains Persian -> always rtl in input
    expect(getActiveTypingDirection(text, 10)).toBe('rtl')
    expect(getActiveTypingDirection(text, 25)).toBe('rtl')
    expect(getActiveTypingDirection(text, 45)).toBe('rtl')
  })

  it('determines line direction with getLineDirection', () => {
    expect(getLineDirection('یک خط کاملاً فارسی')).toBe('rtl')
    expect(getLineDirection('An entirely English line')).toBe('ltr')
    expect(getLineDirection('')).toBe('rtl')
  })
})
