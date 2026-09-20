/**
 * Client-side validators shared across forms.
 * Kept in sync with the backend's class-validator rules (@IsEmail) so the
 * inline Persian error appears BEFORE the request is sent — the HTML5
 * `type="email"` native bubble (English, browser-drawn) is suppressed with
 * `novalidate` on the forms.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** true only for `local@domain.tld` (an `@` AND a dot in the domain). */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test((value ?? '').trim())
}
