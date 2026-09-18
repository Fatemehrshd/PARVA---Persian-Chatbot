/**
 * ماژول کمکی فرمت‌بندی تاریخ و زمان رسمی جمهوری اسلامی ایران
 * با اعمال صریح منطقه زمانی آسیا/تهران (Asia/Tehran) و تقویم شمسی (fa-IR)
 */

/**
 * تبدیل تاریخ میلادی/ایزو به تاریخ شمسی با منطقه زمانی تهران
 * مثال خروجی: ۱۴۰۵/۰۶/۲۶
 */
export function formatIranDate(
  dateInput?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!dateInput) return '—'
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return '—'

  return d.toLocaleDateString('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options,
  })
}

/**
 * تبدیل زمان به ساعت رسمی ایران با منطقه زمانی تهران
 * مثال خروجی: ۱۷:۲۶
 */
export function formatIranTime(
  dateInput?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!dateInput) return '—'
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return '—'

  return d.toLocaleTimeString('fa-IR', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  })
}

/**
 * تبدیل تاریخ و ساعت کامل با منطقه زمانی تهران
 * مثال خروجی: ۱۴۰۵/۰۶/۲۶، ۱۷:۲۶
 */
export function formatIranDateTime(
  dateInput?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!dateInput) return '—'
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput
  if (isNaN(d.getTime())) return '—'

  return d.toLocaleString('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  })
}
