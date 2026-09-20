/**
 * Centralized client-side error message localization.
 *
 * Every error surfaced to the user passes through `translateServerMessage`
 * (called from `services/api.ts`, the single funnel for all HTTP errors), so:
 *   1. Known English backend messages are shown in Persian.
 *   2. Any unrecognized non-Persian message (raw framework/DB text, a leak
 *      from a future endpoint, etc.) NEVER reaches the user as-is — it is
 *      replaced by a generic Persian fallback.
 *   3. Already-Persian server messages (the majority) pass through untouched.
 */

const NETWORK_ERROR = 'ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت خود را بررسی کنید.'

const GENERIC_FALLBACK = 'خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.'

/** Exact-match translations for backend messages still served in English. */
const EXACT: Record<string, string> = {
  'Resource not found': 'منبع مورد نظر پیدا نشد.',
  'Admin only': 'این عملیات فقط برای مدیر سیستم مجاز است.',
  'Missing or invalid access token': 'نشست شما معتبر نیست؛ لطفاً دوباره وارد شوید.',
  'Email is already registered': 'این نشانی ایمیل قبلاً ثبت شده است.',
  'Selected AI model is currently disabled': 'مدل انتخاب‌شده در حال حاضر غیرفعال است.',
  'Selected AI model does not exist': 'مدل انتخاب‌شده وجود ندارد.',
  'Model does not belong to this provider': 'این مدل متعلق به این ارائه‌دهنده نیست.',
  'Model not found': 'مدل پیدا نشد.',
  'Provider not found': 'ارائه‌دهنده پیدا نشد.',
  'Invalid path': 'مسیر درخواست نامعتبر است.',
  'Object storage (MinIO) is not configured; avatar upload is disabled':
    'سرویس ذخیره‌سازی تصویر در دسترس نیست؛ لطفاً بعداً دوباره تلاش کنید.',
  'Internal server error': 'خطای غیرمنتظره در سرور رخ داده است. لطفاً دوباره تلاش کنید.',
  'An error occurred during submission': 'عملیات با خطا مواجه شد.',
  'Failed to fetch models': 'خطا در دریافت فهرست مدل‌ها',
}

/** Pattern-based translations for dynamic backend messages. */
const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^Provider "(.+)" already exists$/u, (m) => `ارائه‌دهنده «${m[1]}» قبلاً ثبت شده است.`],
  [/^The model '(.+)' does not exist$/u, (m) => `مدل «${m[1]}» وجود ندارد.`],
  [
    /^property "?([\w.]+)"? should (not exist|not be empty)$/u,
    (m) => `فیلد «${m[1]}» در درخواست مجاز نیست.`,
  ],
  [/^property "?([\w.]+)"? must be (a |an )?[\w ]+$/u, (m) => `فیلد «${m[1]}» نامعتبر است.`],
  [/^(Failed to fetch|NetworkError|Load failed|Network request failed)$/u, () => NETWORK_ERROR],
]

const HAS_PERSIAN = /[\u0600-\u06FF]/

function translateOne(message: string): string {
  const trimmed = (message ?? '').trim()
  if (!trimmed) return GENERIC_FALLBACK
  if (EXACT[trimmed]) return EXACT[trimmed]
  for (const [pattern, build] of PATTERNS) {
    const m = trimmed.match(pattern)
    if (m) return build(m)
  }
  // Already user-facing Persian (the vast majority of backend messages).
  if (HAS_PERSIAN.test(trimmed)) return trimmed
  // Unknown non-Persian text must never leak to the user as-is.
  return GENERIC_FALLBACK
}

/**
 * Localize a backend error message. Accepts the envelope `message` field,
 * which may be a string or an array of class-validator messages; arrays are
 * translated per-element and returned as an array so field-level error
 * mapping upstream keeps working.
 */
export function translateServerMessage(message: unknown): string | string[] {
  if (Array.isArray(message)) return message.map((m) => translateOne(String(m)))
  return translateOne(String(message ?? ''))
}

export { NETWORK_ERROR, GENERIC_FALLBACK }
