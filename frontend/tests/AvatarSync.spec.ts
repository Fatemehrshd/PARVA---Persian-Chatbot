import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../src/stores/auth'
import { authService } from '../src/services/auth.service'
import { profileService } from '../src/services/profile.service'

// The login/signup payload carries no avatarUrl (backend auth contract),
// so the store must refresh the profile right after the session starts.
const loginResponse = {
  user: { id: 'u1', email: 'admin@parva.co', displayName: 'مدیر سیستم', role: 'admin' },
  accessToken: 'tok-1',
  refreshToken: 'ref-1',
}

const fullProfile = {
  ...loginResponse.user,
  username: null,
  avatarUrl: 'http://localhost:3000/static/avatars/u1/pic.png',
  createdAt: new Date().toISOString(),
}

describe('authStore: immediate avatar availability', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('populates avatarUrl right after login without opening the profile modal', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue(loginResponse as any)
    vi.spyOn(profileService, 'getProfile').mockResolvedValue(fullProfile as any)
    // Admin identity re-sync hits /admin/users; not part of this scenario.
    vi.spyOn((await import('../src/services/admin.service')).adminService, 'listUsers').mockResolvedValue([] as any)

    const auth = useAuthStore()
    await expect(auth.login('admin@parva.co', 'Passw0rd!123')).resolves.toBe(true)

    await vi.waitFor(() => {
      expect(auth.user?.avatarUrl).toBe('http://localhost:3000/static/avatars/u1/pic.png')
    })
    expect(auth.user?.role).toBe('admin')
    expect(localStorage.getItem('user')).toContain('avatars/u1')
  })

  it('restores the avatar on page refresh with an existing session', async () => {
    localStorage.setItem('token', 'saved-tok')
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 'u1', email: 'admin@parva.co', displayName: 'مدیر سیستم', role: 'admin' }),
    )

    const getProfileSpy = vi
      .spyOn(profileService, 'getProfile')
      .mockResolvedValue(fullProfile as any)

    const auth = useAuthStore()
    await vi.waitFor(() => {
      expect(getProfileSpy).toHaveBeenCalled()
      expect(auth.user?.avatarUrl).toBe('http://localhost:3000/static/avatars/u1/pic.png')
    })
  })

  it('keeps the session usable when the profile refresh fails', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue(loginResponse as any)
    vi.spyOn(profileService, 'getProfile').mockRejectedValue({ statusCode: 500, message: 'boom' })

    const auth = useAuthStore()
    await expect(auth.login('admin@parva.co', 'Passw0rd!123')).resolves.toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user?.displayName).toBe('مدیر سیستم')
  })
})
