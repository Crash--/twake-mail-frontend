import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import {
  lazy,
  Suspense,
  useMemo,
  type ReactElement,
  type ReactNode
} from 'react'

import { ConfirmProvider } from '@common/features/confirm/ConfirmProvider'
import { NotificationsProvider } from '@common/features/notifications/NotificationsProvider'
import { I18nProvider } from '@common/i18n/I18nProvider'
import { overlayThemeOptions, SpaceOverlayProvider } from '@linagora/twake-mui'
import type { SpaceOverlay } from '@linagora/twake-mui'
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
 * Theme, translations, data cache, notifications and confirmations: what every screen
 * needs, including the ones shown before authentication.
 */
export function AppProviders({
  lang,
  queryClient,
  debug = false,
  overlay = null,
  children
}: AppProvidersProps): ReactElement {
  const themeOptions = useMemo(
    () => (overlay === null ? undefined : overlayThemeOptions(overlay)),
    [overlay]
  )
  return (
    <TwakeMuiThemeProvider themeOptions={themeOptions}>
      <SpaceOverlayProvider overlay={overlay}>
        <I18nProvider lang={lang}>
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
        </I18nProvider>
      </SpaceOverlayProvider>
    </TwakeMuiThemeProvider>
  )
}
