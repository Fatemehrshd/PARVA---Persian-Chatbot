/**
 * Base HTTP Client for Codeless Frontend.
 * Reads API Base URL from environment (VITE_API_BASE_URL) and injects JWT Bearer token.
 * Formats errors according to OpenAPI Error envelope: { statusCode, message, error }.
 */

import { NETWORK_ERROR, translateServerMessage } from '../utils/errorMessages'

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public error?: string,
    /** Original (untranslated) message; may be an array of validator messages. */
    public rawMessage?: string | string[]
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL
  if (envUrl && typeof envUrl === 'string') {
    return envUrl.replace(/\/+$/, '')
  }
  return 'http://localhost:3000'
}

export function buildUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint
  }
  const base = getApiBaseUrl()
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${base}${cleanEndpoint}`
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token')
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const url = buildUrl(endpoint)

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers
    })
  } catch {
    // Network-level failure (offline, DNS, CORS, server down). The raw
    // browser message ("Failed to fetch") must never reach the user.
    throw new ApiError(0, NETWORK_ERROR, 'Network Error')
  }

  const quotaHeader = response.headers?.get?.('x-user-quota')
  if (quotaHeader && !endpoint.includes('/auth/')) {
    try {
      // The snapshot always belongs to the holder of the CURRENT session
      // token; if the user logged out/switched accounts mid-flight, the stale
      // numbers must not leak into the new session.
      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()
      if (store.token === token) {
        store.applyQuotaSnapshot(JSON.parse(atob(quotaHeader)))
      }
    } catch {
      // Ignore malformed or unavailable quota snapshots.
    }
  }

  // 204 No Content
  if (response.status === 204) {
    return {} as T
  }

  const json = await response.json().catch(() => ({}))

  if (!response.ok) {
    // Localize first: the user must never see a raw English or
    // framework-internal message, no matter which caller renders err.message.
    const rawMessage = Array.isArray(json.message)
      ? json.message
      : (typeof json.message === 'string' && json.message ? json.message : 'An unexpected error occurred')
    const translated = translateServerMessage(rawMessage)
    const message = Array.isArray(translated) ? translated.join('، ') : translated

    // Global 401 Unauthorized handling (session expired or invalid token)
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/signup')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('refreshToken')
      try {
        const { useUiStore } = await import('../stores/ui')
        useUiStore().showToast('نشست کاربری شما منقضی شده است. لطفاً مجدداً وارد شوید.', 'warning')
      } catch {
        // UI store not available in non-Vue context
      }
      if (
        typeof window !== 'undefined' &&
        window.location.pathname !== '/login' &&
        (!import.meta.env || import.meta.env.MODE !== 'test')
      ) {
        window.location.href = '/login'
      }
    }

    // Global 500+ Internal Server Error notification
    if (response.status >= 500) {
      try {
        const { useUiStore } = await import('../stores/ui')
        useUiStore().showToast(message || 'خطای سرور رخ داده است. لطفاً بعداً تلاش کنید.', 'error')
      } catch {
        // UI store not available in non-Vue context
      }
    }

    // Localize before throwing: the user must never see a raw English or
    // framework-internal message, no matter which caller renders err.message.
    throw new ApiError(response.status, message, json.error, json.message)
  }

  // Handle standard { success, message, data } API response envelope
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    if (json.success === false) {
      throw new ApiError(response.status, json.message || 'Operation failed', json.error)
    }
    return json.data as T
  }

  return json as T
}

export async function checkBackendHealth(timeoutMs = 3500): Promise<boolean> {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine) {
    return false
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = buildUrl('/health')
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache'
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
