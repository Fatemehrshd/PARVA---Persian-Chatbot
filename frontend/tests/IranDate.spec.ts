import { describe, it, expect } from 'vitest'
import { formatIranDate, formatIranTime, formatIranDateTime } from '../src/lib/date'

describe('Iran Standard Time Formatting (Asia/Tehran)', () => {
  it('formats UTC ISO timestamp into Tehran local time', () => {
    // 12:00 UTC = 15:30 IRST (standard time +3:30)
    const isoString = '2026-09-17T12:00:00.000Z'
    const time = formatIranTime(isoString)
    expect(time).toContain('۱۵:۳۰')
  })

  it('formats date into Jalali (Shamsi) calendar', () => {
    const isoString = '2026-09-17T12:00:00.000Z'
    const date = formatIranDate(isoString)
    // 2026-09-17 corresponds to 1405-06-26 in Solar Hijri calendar
    expect(date).toContain('۱۴۰۵')
  })

  it('returns placeholder for null or invalid inputs', () => {
    expect(formatIranDate(null)).toBe('—')
    expect(formatIranTime(undefined)).toBe('—')
    expect(formatIranDateTime('invalid-date')).toBe('—')
  })
})
