import * as Sentry from '@sentry/react'

import type { AppConfig } from '@common/config/config'
import { scrubDeep } from '@common/utils/scrubSensitiveData'

/**
 * Starts error reporting when a Sentry DSN is configured. Every event and
 * breadcrumb is scrubbed before it leaves the browser: URLs lose their query
 * string, and credentials and email addresses are masked.
 */
export function initSentry(config: AppConfig): boolean {
  if (!config.sentryDsn) return false

  Sentry.init({
    dsn: config.sentryDsn,
    release: config.appVersion,
    // Nothing about the user nor the HTTP exchanges: mails, tokens and
    // addresses travel in them
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false
    },
    integrations: [
      Sentry.captureConsoleIntegration({ levels: ['warn', 'error'] })
    ],
    beforeSend: event => scrubDeep(event),
    beforeBreadcrumb: breadcrumb => scrubDeep(breadcrumb)
  })
  return true
}

/**
 * Reports an error caught by a React error boundary. A no-op when Sentry is
 * not started.
 */
export function reportRenderError(
  error: unknown,
  componentStack: string
): void {
  Sentry.captureException(error, {
    contexts: { react: { componentStack } }
  })
}
