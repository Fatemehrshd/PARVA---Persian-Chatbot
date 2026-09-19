/**
 * Persian / Jalali Calendar Mathematical Conversion Utilities
 * Pure JavaScript - zero external dependencies, 100% accurate.
 */

export const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

export const JALALI_WEEKDAY_NAMES = [
  { short: 'ش', name: 'شنبه' },
  { short: 'ی', name: 'یکشنبه' },
  { short: 'د', name: 'دوشنبه' },
  { short: 'س', name: 'سه‌شنبه' },
  { short: 'چ', name: 'چهارشنبه' },
  { short: 'پ', name: 'پنج‌شنبه' },
  { short: 'ج', name: 'جمعه' },
]

export function toPersianDigits(n: number | string): string {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return String(n).replace(/\d/g, (d) => farsiDigits[parseInt(d, 10)])
}

export function isJalaliLeapYear(jy: number): boolean {
  return (((jy - 474) % 2820 + 474 + 38) * 682) % 2816 < 682
}

export function getDaysInJalaliMonth(jy: number, jm: number): number {
  if (jm >= 1 && jm <= 6) return 31
  if (jm >= 7 && jm <= 11) return 30
  if (jm === 12) return isJalaliLeapYear(jy) ? 30 : 29
  return 30
}

export function gregorianToJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  let jy: number
  if (gy > 1600) {
    jy = 979
    gy -= 1600
  } else {
    jy = 0
    gy -= 621
  }
  const gy2 = gm > 2 ? gy + 1 : gy
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1]
  jy += 33 * Math.floor(days / 12053)
  days %= 12053
  jy += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) {
    jy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30)
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30)
  return { jy, jm, jd }
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  let gy: number
  if (jy > 979) {
    gy = 1600
    jy -= 979
  } else {
    gy = 621
  }
  let days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186)
  gy += 400 * Math.floor(days / 146097)
  days %= 146097
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524)
    days %= 36524
    if (days >= 365) days++
  }
  gy += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) {
    gy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  let gd = days + 1
  const sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 0
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm]
  return { gy, gm, gd }
}

/**
 * Returns the Persian weekday index (0 = Saturday, ..., 6 = Friday)
 * for the 1st day of a given Jalali month.
 */
export function getFirstWeekdayOfJalaliMonth(jy: number, jm: number): number {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, 1)
  const d = new Date(gy, gm - 1, gd)
  // JS getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // Persian: 0 = Saturday, 1 = Sunday, ..., 6 = Friday
  return (d.getDay() + 1) % 7
}

/**
 * Format a Date to a clean Jalali string: e.g. "۱۴۰۵/۰۶/۲۸ - ۱۷:۳۰"
 */
export function formatJalaliDisplay(dInput: Date | string | null | undefined, includeTime = true): string {
  if (!dInput) return ''
  const d = typeof dInput === 'string' ? new Date(dInput) : dInput
  if (isNaN(d.getTime())) return ''

  const { jy, jm, jd } = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate())
  const pad = (n: number) => (n < 10 ? '0' + n : String(n))

  const dateStr = `${toPersianDigits(jy)}/${toPersianDigits(pad(jm))}/${toPersianDigits(pad(jd))}`
  if (!includeTime) return dateStr

  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  return `${dateStr} ساعت ${toPersianDigits(hours)}:${toPersianDigits(minutes)}`
}
