const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export function normalizeNumericInput(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[٫٬،]/g, (separator) => (separator === '٫' ? '.' : ''))
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
    .replace(/(?!^)-/g, '')
    .replace(/(\..*)\./g, '$1')
}

export function numericInputValue(value: string): number | null {
  const normalized = normalizeNumericInput(value).trim()
  if (!normalized || normalized === '-' || normalized === '.') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}
