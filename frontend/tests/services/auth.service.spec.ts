import { describe, it, expect, beforeEach, vi } from 'vitest'
import { authService } from '../../src/services/auth.service'
import * as apiModule from '../../src/services/api'

describe('Auth Service (auth.service.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls POST /auth/signup with email, password, and displayName', async () => {
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue({
      user: { id: 'u-1', email: 'test@example.com', role: 'user' },
      accessToken: 'token-123',
      refreshToken: 'ref-123'
    } as any)

    const res = await authService.signup('test@example.com', 'secret123', 'John')

    expect(requestSpy).toHaveBeenCalledWith('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'secret123', displayName: 'John' })
    })
    expect(res.user.email).toBe('test@example.com')
  })

  it('calls POST /auth/login with email and password', async () => {
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue({
      user: { id: 'u-1', email: 'test@example.com', role: 'user' },
      accessToken: 'token-123',
      refreshToken: 'ref-123'
    } as any)

    const res = await authService.login('test@example.com', 'secret123')

    expect(requestSpy).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'secret123' })
    })
    expect(res.accessToken).toBe('token-123')
  })

  it('calls POST /auth/logout with refreshToken', async () => {
    const requestSpy = vi.spyOn(apiModule, 'request').mockResolvedValue({} as any)

    await authService.logout('ref-123')

    expect(requestSpy).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: 'ref-123' })
    })
  })
})
