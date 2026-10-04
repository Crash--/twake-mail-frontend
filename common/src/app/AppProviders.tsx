import { TwakeMuiThemeProvider } from '@linagora/twake-mui'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { lazy, Suspense, type ReactElement, type ReactNode } from 'react'

import { I18nProvider } from '@common/i18n/I18nProvider'
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
  children: ReactNode
}

/**
 * Theme, translations and data cache: what every screen needs, including
 * the ones shown before authentication.
 */
export function AppProviders({
  lang,
  queryClient,
  debug = false,
  children
}: AppProvidersProps): ReactElement {
  return (
    <TwakeMuiThemeProvider>
      <I18nProvider lang={lang}>
        <QueryClientProvider client={queryClient}>
          {children}
          {debug ? (
            <Suspense fallback={null}>
              <ReactQueryDevtools buttonPosition="bottom-left" />
            </Suspense>
          ) : null}
        </QueryClientProvider>
      </I18nProvider>
    </TwakeMuiThemeProvider>
  )
}
