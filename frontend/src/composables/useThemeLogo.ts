import { computed, type ComputedRef } from 'vue'
import { useUiStore } from '../stores/ui'
import logoFallback from '@/assets/logo.jpg'

/**
 * Composable for theme-aware branding logo selection.
 *
 * Picks the right logo file from `src/assets/` based on the current theme:
 *  - Dark  → prefers `logo-white.*`, falls back to `logo-dark.*`
 *  - Light → prefers `logo-blue.*`,  falls back to `logo-light.*`
 *  - If no theme variant exists, always falls back to `logo.jpg`.
 *
 * Theme-specific files are detected at build time via Vite's
 * `import.meta.glob` so no extra wiring is needed when adding new
 * variants — just drop a `logo-<variant>.<ext>` file in `src/assets/`.
 */
// We keep two separate globs per theme so the preferred variant
// (`*-white` for dark, `*-blue` for light) is always picked first
// regardless of file-system ordering returned by Vite.
const darkPreferredLogos = import.meta.glob(
  '@/assets/logo*-white.{jpg,jpeg,png,webp,svg}',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>

const darkFallbackLogos = import.meta.glob(
  '@/assets/logo*-dark.{jpg,jpeg,png,webp,svg}',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>

const lightPreferredLogos = import.meta.glob(
  '@/assets/logo*-blue.{jpg,jpeg,png,webp,svg}',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>

const lightFallbackLogos = import.meta.glob(
  '@/assets/logo*-light.{jpg,jpeg,png,webp,svg}',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>

const darkLogoUrl =
  Object.values(darkPreferredLogos)[0] ?? Object.values(darkFallbackLogos)[0]
const lightLogoUrl =
  Object.values(lightPreferredLogos)[0] ?? Object.values(lightFallbackLogos)[0]

export interface UseThemeLogoReturn {
  /** Reactive logo URL that swaps when the theme changes. */
  activeLogo: ComputedRef<string>
  /** The always-available fallback logo (`logo.jpg`). */
  fallbackLogo: string
  /** URL of the detected dark-theme variant, if any. */
  darkLogoUrl: string | undefined
  /** URL of the detected light-theme variant, if any. */
  lightLogoUrl: string | undefined
}

export function useThemeLogo(): UseThemeLogoReturn {
  const uiStore = useUiStore()

  const activeLogo = computed(() => {
    if (uiStore.theme === 'dark') {
      return darkLogoUrl ?? logoFallback
    }
    return lightLogoUrl ?? logoFallback
  })

  return {
    activeLogo,
    fallbackLogo: logoFallback,
    darkLogoUrl,
    lightLogoUrl,
  }
}
