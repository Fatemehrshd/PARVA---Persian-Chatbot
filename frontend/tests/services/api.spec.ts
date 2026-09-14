import { describe, it, expect, beforeEach, vi } from 'vitest'
import { request, ApiError, buildUrl, getApiBaseUrl } from '../../src/services/api'

describe('Base API Client (api.ts)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('buildUrl handles relative endpoints and respects base URL', () => {
    const url = buildUrl('/auth/login')
    expect(url).toBe(`${getApiBaseUrl()}/auth/login`)

    const absolute = buildUrl('https://custom.api/v1/auth/login')
    expect(absolute).toBe('https://custom.api/v1/auth/login')
  })

  it('injects Authorization Bearer token when token is present in localStorage', async () => {
    localStorage.setItem('token', 'sample-jwt-token')

    let capturedHeaders!: Headers
    global.fetch = vi.fn().mockImplementation((_url, options) => {
      capturedHeaders = new Headers(options.headers)
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      } as any)
    })

    const result = await request<{ success: boolean }>('/test-endpoint')

    expect(result.success).toBe(true)
    expect(capturedHeaders.get('Authorization')).toBe('Bearer sample-jwt-token')
    expect(capturedHeaders.get('Content-Type')).toBe('application/json')
  })

  it('unwraps data payload from standard { success, message, data } API response envelope', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        message: 'Operation successful',
        data: { id: 'item-1', name: 'Item One' }
      })
    } as any)

    const result = await request<{ id: string; name: string }>('/items/item-1')
    expect(result).toEqual({ id: 'item-1', name: 'Item One' })
  })

  it('handles 204 No Content responses correctly without JSON parsing error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204
    } as any)

    const result = await request<void>('/auth/logout', { method: 'POST' })
    expect(result).toEqual({})
  })

  it('throws ApiError with status and message when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        statusCode: 409,
        message: 'Email is already registered',
        error: 'Conflict'
      })
    } as any)

    await expect(request('/auth/signup', { method: 'POST' })).rejects.toThrow('Email is already registered')
  })
})

