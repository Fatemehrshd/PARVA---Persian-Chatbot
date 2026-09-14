/**
 * Base HTTP Client for Codeless Frontend.
 * Reads API Base URL from environment (VITE_API_BASE_URL) and injects JWT Bearer token.
 * Formats errors according to OpenAPI Error envelope: { statusCode, message, error }.
 */

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public error?: string
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

  const response = await fetch(url, {
    ...options,
    headers
  })

  // 204 No Content
  if (response.status === 204) {
    return {} as T
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = data.message || (Array.isArray(data.message) ? data.message.join(', ') : 'An unexpected error occurred')
    throw new ApiError(response.status, message, data.error)
  }

  return data as T
}
