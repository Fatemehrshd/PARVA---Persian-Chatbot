import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '../src/stores/ui'
import { useAuthStore } from '../src/stores/auth'
import { authService } from '../src/services/auth.service'
import { profileService } from '../src/services/profile.service'

/**
 * Theme behavior contract:
 * 1. The default theme for every user is LIGHT.
 * 2. Each signed-in user gets their own backend-persisted theme, independent
 *    of other users, and it survives a page refresh.
 * 3. The login page always renders in the light theme (view-local override,
 *    never persisted).
 */

const userA = { id: 'ua', email: 'a@parva.co', displayName: 'کاربر تیره', role: 'user' }
const userB = { id: 'ub', email: 'b@parva.co', displayName: 'کاربر روشن', role: 'user' }

const profileBase = {
  username: null,
  avatarUrl: null,
  createdAt: new Date().toISOString(),
}

function loginResponse(user: typeof userA) {
  return { user, accessToken: `tok-${user.id}`, refreshToken: `ref-${user.id}` }
}

function profileFor(user: typeof userA) {
  return { ...user, ...profileBase, isActive: true }
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('theme: defaults, per-user independence, login page', () => {
  it('parses the theme endpoint response whether it is a bare string or the { preference } envelope', async () => {
    // Regression: the backend once served the raw value ("dark") while the
    // client read `.preference`, so every refresh silently reset dark → light.
    const jsonOk = (body: unknown) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    const fetchMock = vi
      .fn()
      // legacy bare-string shape
      .mockResolvedValueOnce(jsonOk('dark'))
      // documented envelope shape
      .mockResolvedValueOnce(jsonOk({ preference: 'light' }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      expect(await profileService.getThemePreference()).toBe('dark')
      expect(await profileService.getThemePreference()).toBe('light')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('defaults to the light theme for a brand-new user', () => {
    const ui = useUiStore()
    expect(ui.effectiveTheme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('login page always renders light and never overwrites the stored theme', async () => {
    localStorage.setItem('theme', 'dark')
    const ui = useUiStore()
    expect(ui.effectiveTheme).toBe('dark')

    ui.setAuthPageLightMode(true)
    await nextTick()
    expect(ui.effectiveTheme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    // View-local override: the stored theme must stay untouched.
    expect(localStorage.getItem('theme')).toBe('dark')

    // Leaving the login page restores the session's own theme.
    ui.setAuthPageLightMode(false)
    await nextTick()
    expect(ui.effectiveTheme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('keeps each user independent: dark preference follows user A, user B falls back to light', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue(loginResponse(userA) as any)
    vi.spyOn(profileService, 'getProfile').mockResolvedValue(profileFor(userA) as any)
    vi.spyOn(profileService, 'getThemePreference').mockResolvedValue('dark')
    vi.spyOn(authService, 'logout').mockResolvedValue({} as any)

    const auth = useAuthStore()
    const ui = useUiStore()

    // User A signs in → their persisted dark preference applies.
    await expect(auth.login(userA.email, 'Passw0rd!123')).resolves.toBe(true)
    expect(ui.userThemePreference).toBe('dark')
    expect(ui.effectiveTheme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    // Logout wipes the per-user session back to the light default.
    await auth.logout()
    expect(ui.userThemePreference).toBeNull()
    expect(ui.effectiveTheme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    // User B (no preference set) gets the light default — never user A's dark.
    vi.spyOn(authService, 'login').mockResolvedValue(loginResponse(userB) as any)
    vi.spyOn(profileService, 'getProfile').mockResolvedValue(profileFor(userB) as any)
    vi.spyOn(profileService, 'getThemePreference').mockResolvedValue(null)
    await expect(auth.login(userB.email, 'Passw0rd!123')).resolves.toBe(true)
    expect(ui.userThemePreference).toBeNull()
    expect(ui.effectiveTheme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('survives a page refresh: the synced preference re-applies without flipping', async () => {
    // Simulate a previous session of user A (dark preference) in localStorage.
    localStorage.setItem('theme', 'dark')
    localStorage.setItem('token', 'tok-ua')
    localStorage.setItem('user', JSON.stringify(userA))

    vi.spyOn(profileService, 'getProfile').mockResolvedValue(profileFor(userA) as any)
    vi.spyOn(profileService, 'getThemePreference').mockResolvedValue('dark')

    // "Refresh": brand-new pinia/store instances over the same storage.
    setActivePinia(createPinia())
    const auth = useAuthStore()
    const ui = useUiStore()

    expect(ui.effectiveTheme).toBe('dark')
    await vi.waitFor(() => {
      expect(ui.themeSynced).toBe(true)
    })
    expect(ui.userThemePreference).toBe('dark')
    expect(ui.effectiveTheme).toBe('dark')
    expect(auth.isAuthenticated).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('a signed-in user without a preference falls back to light even if storage says dark', async () => {
    localStorage.setItem('theme', 'dark')
    localStorage.setItem('token', 'tok-ub')
    localStorage.setItem('user', JSON.stringify(userB))

    vi.spyOn(profileService, 'getProfile').mockResolvedValue(profileFor(userB) as any)
    vi.spyOn(profileService, 'getThemePreference').mockResolvedValue(null)

    setActivePinia(createPinia())
    useAuthStore()
    const ui = useUiStore()

    await vi.waitFor(() => {
      expect(ui.themeSynced).toBe(true)
    })
    expect(ui.effectiveTheme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
