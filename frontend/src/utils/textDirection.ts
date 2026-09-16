/**
 * Helper functions to detect text direction (RTL for Persian/Arabic, LTR for English/Latin).
 */

const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
const LATIN_REGEX = /[a-zA-Z\u00C0-\u024F]/

/**
 * Determines whether the given text should be rendered RTL (right-to-left) or LTR (left-to-right).
 * 
 * - If the text contains Persian or Arabic characters and begins with them, returns 'rtl'.
 * - If the text begins with English/Latin characters, returns 'ltr'.
 * - Punctuation, emojis, numbers, and Markdown symbols are ignored during detection.
 * - Defaults to 'rtl' if text is empty or neutral.
 */
export function getTextDirection(
  text: string | null | undefined,
  defaultDir: 'rtl' | 'ltr' = 'rtl'
): 'rtl' | 'ltr' {
  if (!text || typeof text !== 'string') return defaultDir

  // Strip Markdown markers, numbers, punctuation, symbols, and whitespace
  const clean = text.replace(/[\d\s.,\/#!$%\^&\*;:{}=\-_`~()@+?><\[\]'"\\|`]/g, '')
  if (!clean) {
    // If only symbols or numbers, check if original text contains any Persian letter
    if (RTL_REGEX.test(text)) return 'rtl'
    if (LATIN_REGEX.test(text)) return 'ltr'
    return defaultDir
  }

  // Detect based on the first strong alphabetical character
  for (const char of clean) {
    if (RTL_REGEX.test(char)) return 'rtl'
    if (LATIN_REGEX.test(char)) return 'ltr'
  }

  // Fallback: if any RTL character exists in the text
  if (RTL_REGEX.test(text)) return 'rtl'
  if (LATIN_REGEX.test(text)) return 'ltr'
  return defaultDir
}

/**
 * Detects the active typing direction for an interactive input/textarea in real-time.
 * 
 * USER EXPLICIT REQUIREMENT:
 * «توی اینپوت هندل کن اگر کلمه فارسی و انگلیسی بود میبایست rtl باشه»
 * 
 * - If text contains Persian/Arabic characters (even if English/Latin words are also present) -> 'rtl'.
 * - If text contains only English/Latin characters (no Persian characters at all) -> 'ltr'.
 * - If text is empty, whitespace, or only neutral symbols/numbers -> defaultDir ('rtl').
 */
export function getActiveTypingDirection(
  text: string | null | undefined,
  _cursorPos?: number | null,
  defaultDir: 'rtl' | 'ltr' = 'rtl'
): 'rtl' | 'ltr' {
  if (!text || typeof text !== 'string') return defaultDir
  if (!text.trim()) return defaultDir

  // If text contains Persian or Arabic, mixed text MUST always be RTL
  if (RTL_REGEX.test(text)) {
    return 'rtl'
  }

  // Only if text is pure English / Latin
  if (LATIN_REGEX.test(text)) {
    return 'ltr'
  }

  return defaultDir
}

/**
 * Determines the direction of an individual line or paragraph.
 */
export function getLineDirection(
  line: string | null | undefined,
  defaultDir: 'rtl' | 'ltr' = 'rtl'
): 'rtl' | 'ltr' {
  return getTextDirection(line, defaultDir)
}
