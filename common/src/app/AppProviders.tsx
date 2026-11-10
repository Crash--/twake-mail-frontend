import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import {
  lazy,
  Suspense,
  useMemo,
  type ReactElement,
  type ReactNode
} from 'react'

import { ColorSchemeSync } from '@common/app/ColorSchemeSync'
import { DocumentTitleProvider } from '@common/app/DocumentTitleProvider'
import { ConfirmProvider } from '@common/features/confirm/ConfirmProvider'
import { NotificationsProvider } from '@common/features/notifications/NotificationsProvider'
import {
  useFocusIndicator,
  useHighContrast
} from '@common/features/settings/accessibilityPreference'
import { I18nProvider } from '@common/i18n/I18nProvider'
import { overlayThemeOptions, SpaceOverlayProvider } from '@linagora/twake-mui'
import type { SpaceOverlay } from '@linagora/twake-mui'
import {
  focusIndicatorThemeOptions,
  type FocusIndicator
} from '@/ds/FocusIndicator/focusIndicator'
import {
  FORCED_COLORS_CSS,
  HIGH_CONTRAST_COLORS,
  HIGH_CONTRAST_CSS,
  highContrastThemeOptions
} from '@/ds/HighContrast/highContrast'
import { SCROLLBAR_CSS } from '@/ds/ScrollbarLook/scrollbarLook'
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage
} from '@common/i18n/languages'

// The production entry point keeps the devtools out of the main bundle:
// they are only downloaded when DEBUG is on.
const ReactQueryDevtools = lazy(async () => {
  const devtools = await import('@tanstack/react-query-devtools/production')
  return { default: devtools.ReactQueryDevtools }
})

export interface AppProvidersProps {
  lang: SupportedLanguage
  /** The languages the deployment offers (`ALLOWED_LANGUAGES`) */
  allowedLanguages?: readonly SupportedLanguage[]
  queryClient: QueryClient
  debug?: boolean
  /**
   * The overlay of TwakeSpace, when the app is framed there: docked windows
   * and dialogs go onto the page of TwakeSpace
   */
  overlay?: SpaceOverlay | null
  children: ReactNode
}

/**
 * The theme options of the app: the focus indicator, the scroll bars, the
 * forced-colours rules, and the high-contrast scheme when it is on (which
 * replaces the light one, see `ColorSchemeSync`)
 */
function ownThemeOptions(
  focusIndicator: FocusIndicator,
  isHighContrast: boolean
): ReturnType<typeof focusIndicatorThemeOptions> {
  if (!isHighContrast) {
    return focusIndicatorThemeOptions(focusIndicator, {
      ...SCROLLBAR_CSS,
      ...FORCED_COLORS_CSS
    })
  }
  return {
    ...highContrastThemeOptions(),
    ...focusIndicatorThemeOptions(
      focusIndicator,
      { ...SCROLLBAR_CSS, ...HIGH_CONTRAST_CSS, ...FORCED_COLORS_CSS },
      HIGH_CONTRAST_COLORS.focusRing
    )
  }
}

/**
 * Theme (with the focus indicator, the colour scheme and the contrast the
 * user chose),
 * translations, title of the page, data cache, notifications and
 * confirmations: what every screen needs, including the ones shown before
 * authentication.
 */
export function AppProviders({
  lang,
  allowedLanguages = SUPPORTED_LANGUAGES,
  queryClient,
  debug = false,
  overlay = null,
  children
}: AppProvidersProps): ReactElement {
  const focusIndicator = useFocusIndicator()
  const isHighContrast = useHighContrast()
  const themeOptions = useMemo(() => {
    const ownOptions = ownThemeOptions(focusIndicator, isHighContrast)
    if (overlay === null) return ownOptions
    const overlayOptions = overlayThemeOptions(overlay)
    // Neither styles the same components
    return {
      ...overlayOptions,
      ...ownOptions,
      components: { ...overlayOptions.components, ...ownOptions.components }
    }
  }, [focusIndicator, isHighContrast, overlay])
  return (
    <TwakeMuiThemeProvider themeOptions={themeOptions}>
      <ColorSchemeSync />
      <SpaceOverlayProvider overlay={overlay}>
        <I18nProvider lang={lang} allowedLanguages={allowedLanguages}>
          <DocumentTitleProvider>
            <QueryClientProvider client={queryClient}>
              <NotificationsProvider>
                <ConfirmProvider>{children}</ConfirmProvider>
              </NotificationsProvider>
              {debug ? (
                <Suspense fallback={null}>
                  <ReactQueryDevtools buttonPosition="bottom-left" />
                </Suspense>
              ) : null}
            </QueryClientProvider>
          </DocumentTitleProvider>
        </I18nProvider>
      </SpaceOverlayProvider>
    </TwakeMuiThemeProvider>
  )
}
