import { useColorScheme, useTheme } from '@linagora/twake-mui'
import { useEffect, useLayoutEffect, type ReactElement } from 'react'

import { themePreference } from '@common/features/settings/themePreference'

/**
 * Colours the app as the theme setting of the account says (light, dark, or
 * as the system; its copy in this browser, see `themePreference`): the
 * colour scheme of twake-mui follows it, and so do the controls of the
 * browser (`color-scheme` of the document) and the colour of its chrome
 * (`theme-color`). The inline script of `public/index.html` does the same
 * before the app is loaded, so that the page never flashes white.
 */
export function ColorSchemeSync(): ReactElement | null {
  const preference = themePreference.useValue()
  const { setMode, colorScheme } = useColorScheme()
  const theme = useTheme()

  // Before the first paint: twake-mui starts light whatever the page says
  useLayoutEffect(() => {
    // `auto` of the setting is the `system` mode of twake-mui
    setMode(preference === 'auto' ? 'system' : preference)
  }, [preference, setMode])

  useEffect(() => {
    if (colorScheme === undefined) return
    const root = document.documentElement
    root.style.colorScheme = colorScheme
    const background =
      theme.colorSchemes[colorScheme]?.palette.background.default
    if (background !== undefined) {
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', background)
    }
  }, [colorScheme, theme])

  return null
}
