/**
 * JWT utilities for client-side token parsing and expiration verification.
 */

export interface JwtPayload {
  sub?: string
  email?: string
  role?: string
  exp?: number
  iat?: number
  [key: string]: any
}

export function decodeJwtPayload(token?: string | null): JwtPayload | null {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const raw = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary')
    const jsonStr = decodeURIComponent(
      Array.prototype.map
        .call(raw, (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}

/**
 * Check whether a JWT token has expired or will expire within the buffer window (default 5s).
 * Returns false if token cannot be parsed or lacks an exp claim (to avoid false logouts in mock/dev tests).
 */
export function isTokenExpired(token?: string | null, bufferSeconds = 5): boolean {
  if (!token) return true
  const payload = decodeJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return false
  const expiresAtMs = payload.exp * 1000
  return expiresAtMs <= Date.now() + bufferSeconds * 1000
}
