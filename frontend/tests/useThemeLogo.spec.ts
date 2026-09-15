import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useThemeLogo } from '../src/composables/useThemeLogo'
import { useUiStore } from '../src/stores/ui'

describe('useThemeLogo Composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('detects a logo-white variant for dark theme', () => {
    const { darkLogoUrl } = useThemeLogo()
    expect(darkLogoUrl).toBeDefined()
    expect(darkLogoUrl).toMatch(/logo-white\.(png|jpg|jpeg|webp|svg)/i)
  })

  it('detects a logo-blue variant for light theme', () => {
    const { lightLogoUrl } = useThemeLogo()
    expect(lightLogoUrl).toBeDefined()
    expect(lightLogoUrl).toMatch(/logo-blue\.(png|jpg|jpeg|webp|svg)/i)
  })

  it('returns the dark variant when theme is dark', () => {
    const uiStore = useUiStore()
    uiStore.setTheme('dark')

    const { activeLogo, darkLogoUrl } = useThemeLogo()
    expect(activeLogo.value).toBe(darkLogoUrl)
  })

  it('returns the light variant when theme is light', () => {
    const uiStore = useUiStore()
    uiStore.setTheme('light')

    const { activeLogo, lightLogoUrl } = useThemeLogo()
    expect(activeLogo.value).toBe(lightLogoUrl)
  })

  it('updates the active logo reactively when theme changes', () => {
    const { activeLogo, darkLogoUrl, lightLogoUrl } = useThemeLogo()
    const uiStore = useUiStore()

    uiStore.setTheme('dark')
    expect(activeLogo.value).toBe(darkLogoUrl)

    uiStore.setTheme('light')
    expect(activeLogo.value).toBe(lightLogoUrl)
  })
})
