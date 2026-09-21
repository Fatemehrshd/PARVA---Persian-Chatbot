export function normalizeNumericInput(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[٫٬،]/g, (separator) => (separator === '٫' ? '.' : ''))
    .replace(',', '.')
    .trim();
}

export function normalizeNumericValue(value: unknown): unknown {
  const normalized = normalizeNumericInput(value);
  if (normalized === '' || normalized === null || normalized === undefined) return normalized;
  if (typeof normalized !== 'string') return normalized;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : normalized;
}
