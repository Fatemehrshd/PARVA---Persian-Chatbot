/**
 * Helper function to detect text direction (RTL for Persian/Arabic, LTR for English/Latin).
 */

const RTL_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
const LATIN_REGEX = /[a-zA-Z]/

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
