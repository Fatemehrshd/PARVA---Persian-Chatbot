import { describe, it, expect, beforeEach, vi } from 'vitest'
import { request, ApiError, buildUrl, getApiBaseUrl, checkBackendHealth } from '../../src/services/api'

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

  it('throws ApiError with a Persian localized message when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        statusCode: 409,
        message: 'Email is already registered',
        error: 'Conflict'
      })
    } as any)

    // The raw English server message must be localized before reaching callers.
    await expect(request('/auth/signup', { method: 'POST' })).rejects.toThrow(
      'این نشانی ایمیل قبلاً ثبت شده است.'
    )
  })

  it('replaces unknown non-Persian server messages with a generic Persian fallback', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        statusCode: 500,
        message: 'relation "users" does not exist',
        error: 'Internal Server Error'
      })
    } as any)

    // Unknown English/framework text → generic Persian fallback (never raw)
    await expect(request('/anything')).rejects.toThrow('خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.')
  })

  it('translates network-level failures into a Persian offline message', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(request('/anything')).rejects.toMatchObject({
      statusCode: 0,
      message: expect.stringContaining('ارتباط با سرور برقرار نشد')
    })
  })

  it('checkBackendHealth returns true when backend /health returns 200 ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    } as any)

    const isHealthy = await checkBackendHealth(1000)
    expect(isHealthy).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('checkBackendHealth returns false when network fails or times out', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    const isHealthy = await checkBackendHealth(1000)
    expect(isHealthy).toBe(false)
  })

  it('translates known English backend messages and never leaks unknown ones', async () => {
    const { translateServerMessage } = await import('../../src/utils/errorMessages')

    // Exact backend messages → Persian
    expect(translateServerMessage('Resource not found')).toBe('منبع مورد نظر پیدا نشد.')
    expect(translateServerMessage('Admin only')).toBe('این عملیات فقط برای مدیر سیستم مجاز است.')
    expect(translateServerMessage('Email is already registered')).toBe('این نشانی ایمیل قبلاً ثبت شده است.')
    expect(translateServerMessage('Selected AI model is currently disabled')).toBe(
      'مدل انتخاب‌شده در حال حاضر غیرفعال است.'
    )
    expect(translateServerMessage('Internal server error')).toContain('خطای غیرمنتظره')

    // Dynamic patterns
    expect(translateServerMessage('Provider "OpenAI" already exists')).toContain('قبلاً ثبت شده')
    expect(translateServerMessage("The model 'gpt-x' does not exist")).toContain('وجود ندارد')
    expect(translateServerMessage('property foo should not exist')).toContain('مجاز نیست')

    // Persian passes through untouched
    expect(translateServerMessage('ایمیل یا رمز عبور اشتباه است')).toBe('ایمیل یا رمز عبور اشتباه است')

    // Unknown English/framework text → generic Persian fallback (never raw)
    expect(translateServerMessage('QueryFailedError: column does not exist')).toBe(
      'خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.'
    )
    expect(translateServerMessage('')).toBe('خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.')
    expect(translateServerMessage(undefined)).toBe('خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.')

    // Arrays are translated per-element and stay arrays (field-level mapping)
    expect(translateServerMessage(['Resource not found', 'ایمیل الزامی است'])).toEqual([
      'منبع مورد نظر پیدا نشد.',
      'ایمیل الزامی است',
    ])
  })
})


