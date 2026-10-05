import * as Sentry from '@sentry/react'

import { scrubBreadcrumb, scrubEvent } from '@common/app/sentryEvents'

/** What starts the reporting: where to send, and for which release */
export interface SentrySetup {
  dsn: string
  environment: string | null
  release: string
}

/** The reporting that is allowed right now: the setup, and who reports */
export interface SentryReporting {
  setup: SentrySetup
  /** A pseudonym of the account, never an address nor a name */
  userId: string | null
}

export interface SentryLifecycleOptions {
  /** Replaces the transport of the SDK (tests record what would be sent) */
  transport?: Sentry.BrowserOptions['transport']
}

const MAX_BREADCRUMBS = 30

/** Time given to the events already in flight when the reporting stops (ms) */
const CLOSE_TIMEOUT = 100

/**
 * Integrations of the SDK that are not wanted: the breadcrumbs (added back
 * without the DOM ones), the console breadcrumbs, and the sessions of the
 * release health
 */
const DROPPED_INTEGRATIONS = new Set([
  'Breadcrumbs',
  'Console',
  'BrowserSession'
])

function sameSetup(a: SentrySetup, b: SentrySetup): boolean {
  return (
    a.dsn === b.dsn &&
    a.environment === b.environment &&
    a.release === b.release
  )
}

/**
 * Starts and stops error reporting as the user's consent and the account
 * change, without reloading the page. The SDK does not exist until the
 * reporting is allowed: nothing is initialised, nothing is queued before, and
 * what is allowed goes through one gate that every hook of the SDK also
 * checks, so a revocation drops what is not sent yet.
 *
 * What the SDK sends is limited by the options of `start`: no default PII, no
 * session replay, feedback widget, profiling nor tracing, and every event and
 * breadcrumb is rebuilt by `sentryEvents.ts`.
 */
export class SentryLifecycle {
  private readonly options: SentryLifecycleOptions
  private wanted: SentryReporting | null = null
  private running: SentryReporting | null = null
  private queue: Promise<void> = Promise.resolve()

  constructor(options: SentryLifecycleOptions = {}) {
    this.options = options
  }

  /** Whether the reporting is allowed right now: the gate of every hook */
  isAllowed(): boolean {
    return this.wanted !== null
  }

  /** Whether the SDK is started */
  isRunning(): boolean {
    return this.running !== null
  }

  /**
   * Sets what is allowed from now on: a reporting to start (or to keep, or
   * to move to another account), or null to stop. Resolves once the SDK
   * follows. Calls in a row are applied in order, and only the last wish
   * counts.
   */
  apply(reporting: SentryReporting | null): Promise<void> {
    this.wanted = reporting
    this.queue = this.queue.then(() => this.converge())
    return this.queue
  }

  private async converge(): Promise<void> {
    // A wish can change while the SDK starts or closes: look again
    for (let turn = 0; turn < 4; turn += 1) {
      const wanted = this.wanted
      const running = this.running
      if (wanted === null && running === null) return
      if (wanted !== null && running !== null) {
        if (sameSetup(wanted.setup, running.setup)) {
          if (wanted.userId !== running.userId) this.moveUser(wanted)
          return
        }
        await this.stop()
        continue
      }
      if (wanted === null) await this.stop()
      else this.start(wanted)
    }
  }

  private start(reporting: SentryReporting): void {
    const { setup } = reporting
    try {
      Sentry.init({
        dsn: setup.dsn,
        release: setup.release,
        ...(setup.environment ? { environment: setup.environment } : {}),
        ...(this.options.transport
          ? { transport: this.options.transport }
          : {}),
        // Nothing about the user nor the HTTP exchanges: mails, tokens and
        // addresses travel in them (`dataCollection` replaces
        // `sendDefaultPii` in this version of the SDK)
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false
        },
        // No tracing (no `tracesSampleRate`, no browser tracing integration),
        // no profiling, no session replay, no feedback widget, no logs, no
        // release health sessions: none of their integrations is added
        sendClientReports: false,
        maxBreadcrumbs: MAX_BREADCRUMBS,
        denyUrls: [
          /^chrome-extension:\/\//i,
          /^moz-extension:\/\//i,
          /^safari-(web-)?extension:\/\//i
        ],
        integrations: defaults => [
          ...defaults.filter(
            integration => !DROPPED_INTEGRATIONS.has(integration.name)
          ),
          Sentry.breadcrumbsIntegration({
            dom: false,
            fetch: true,
            history: true,
            sentry: false,
            xhr: true
          }),
          // As tmail-flutter, errors are reported and warnings are not
          Sentry.captureConsoleIntegration({ levels: ['error'] })
        ],
        beforeSend: (event, hint) =>
          this.isAllowed() ? scrubEvent(event, hint) : null,
        beforeBreadcrumb: breadcrumb =>
          this.isAllowed() ? scrubBreadcrumb(breadcrumb) : null
      })
      this.running = reporting
      this.moveUser(reporting)
    } catch (error: unknown) {
      // The reporting must never break the app
      console.warn('[sentry] Cannot start', error)
    }
  }

  private moveUser(reporting: SentryReporting): void {
    Sentry.setUser(reporting.userId === null ? null : { id: reporting.userId })
    if (this.running) this.running = reporting
  }

  private async stop(): Promise<void> {
    this.running = null
    // `Sentry.setUser` sets the user on the isolation scope: the other scopes
    // must not get an empty one, which would hide it at the next start
    Sentry.getIsolationScope().setUser(null)
    for (const scope of [
      Sentry.getCurrentScope(),
      Sentry.getIsolationScope(),
      Sentry.getGlobalScope()
    ]) {
      scope.clearBreadcrumbs()
    }
    try {
      await Sentry.close(CLOSE_TIMEOUT)
    } catch (error: unknown) {
      console.warn('[sentry] Cannot close', error)
    }
  }
}

/** The error reporting of the page */
export const sentryLifecycle = new SentryLifecycle()

/**
 * Stops the error reporting and forgets the user: the session ends. The
 * consent is read again from the server at the next sign-in.
 */
export function stopSentryReporting(): void {
  sentryLifecycle.apply(null).catch((error: unknown) => {
    console.warn('[sentry] Cannot stop', error)
  })
}

/**
 * Reports an error caught by a React error boundary. A no-op when the
 * reporting is not started (no client).
 */
export function reportRenderError(
  error: unknown,
  componentStack: string
): void {
  if (!sentryLifecycle.isRunning()) return
  Sentry.captureException(error, {
    contexts: { react: { componentStack } }
  })
}
