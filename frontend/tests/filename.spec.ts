import { describe, it, expect } from 'vitest'
import { fixUtf8MangledString } from '../src/lib/filename'

describe('fixUtf8MangledString', () => {
  it('decodes Windows-1252 mangled Persian filenames', () => {
    const mangled = 'Ø§ÛŒÙ† ÛŒÙ‡ pdf ØªØ³Øª Ù‡Ø³Øª Ù†Ø¸Ø±Øª Ú†ÛŒÙ‡.pdf'
    expect(fixUtf8MangledString(mangled)).toBe('این یه pdf تست هست نظرت چیه.pdf')
  })

  it('decodes Latin-1 mangled Persian filenames', () => {
    const mangled = 'Ø±Ø²ÙˆÙ…Ù‡_Ù…Ù‡Ø¯ÛŒØ§Ø±_ÙˆØ§Ø¹Ø¸_2026-09-14.pdf'
    expect(fixUtf8MangledString(mangled)).toBe('رزومه_مهدیار_واعظ_2026-09-14.pdf')
  })

  it('leaves standard ASCII names intact', () => {
    expect(fixUtf8MangledString('document.pdf')).toBe('document.pdf')
  })

  it('leaves clean Persian names intact', () => {
    expect(fixUtf8MangledString('گزارش_مالی.pdf')).toBe('گزارش_مالی.pdf')
  })

  it('handles empty or null values gracefully', () => {
    expect(fixUtf8MangledString('')).toBe('')
    expect(fixUtf8MangledString(null)).toBe('')
    expect(fixUtf8MangledString(undefined)).toBe('')
  })
})
