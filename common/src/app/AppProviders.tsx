import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import {
  lazy,
  Suspense,
  useMemo,
  type ReactElement,
  type ReactNode
} from 'react'

import { DocumentTitleProvider } from '@common/app/DocumentTitleProvider'
import { ConfirmProvider } from '@common/features/confirm/ConfirmProvider'
import { NotificationsProvider } from '@common/features/notifications/NotificationsProvider'
import { useFocusIndicator } from '@common/features/settings/accessibilityPreference'
import { I18nProvider } from '@common/i18n/I18nProvider'
import { overlayThemeOptions, SpaceOverlayProvider } from '@linagora/twake-mui'
import type { SpaceOverlay } from '@linagora/twake-mui'
import { focusIndicatorThemeOptions } from '@/ds/FocusIndicator/focusIndicator'
import { menuLookThemeOptions } from '@/ds/MenuLook/menuLook'
import { SCROLLBAR_CSS } from '@/ds/ScrollbarLook/scrollbarLook'
import type { SupportedLanguage } from '@common/i18n/languages'

// The production entry point keeps the devtools out of the main bundle:
// they are only downloaded when DEBUG is on.
const ReactQueryDevtools = lazy(async () => {
  const devtools = await import('@tanstack/react-query-devtools/production')
  return { default: devtools.ReactQueryDevtools }
})

export interface AppProvidersProps {
  lang: SupportedLanguage
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
 * Theme (with the focus indicator the user chose), translations, title of
 * the page, data cache, notifications and confirmations: what every screen
 * needs, including the ones shown before authentication.
 */
export function AppProviders({
  lang,
  queryClient,
  debug = false,
  overlay = null,
  children
}: AppProvidersProps): ReactElement {
  const focusIndicator = useFocusIndicator()
  const themeOptions = useMemo(() => {
    // With tmail-flutter's scroll bars, global CSS as the focus ring
    const focusOptions = focusIndicatorThemeOptions(
      focusIndicator,
      SCROLLBAR_CSS
    )
    // The menus of tmail-flutter: none of the others styles them
    const menuOptions = menuLookThemeOptions()
    const ownOptions = {
      ...focusOptions,
      components: { ...menuOptions.components, ...focusOptions.components }
    }
    if (overlay === null) return ownOptions
    const overlayOptions = overlayThemeOptions(overlay)
    // Neither styles the same components
    return {
      ...overlayOptions,
      ...ownOptions,
      components: { ...overlayOptions.components, ...ownOptions.components }
    }
  }, [focusIndicator, overlay])
  return (
    <TwakeMuiThemeProvider themeOptions={themeOptions}>
      <SpaceOverlayProvider overlay={overlay}>
        <I18nProvider lang={lang}>
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
