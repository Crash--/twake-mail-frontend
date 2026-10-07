import * as Sentry from '@sentry/react'
import type { FeedbackLabels } from '@linagora/twake-feedback'
import {
  makeFeedbackIntegration,
  type FeedbackIntegration
} from '@linagora/twake-feedback/sentry'

import { makeFeedbackFocus } from '@common/app/feedbackFocus'
import {
  isFeedbackEvent,
  scrubBreadcrumb,
  scrubEvent,
  scrubFeedbackEvent
} from '@common/app/sentryEvents'

/** What starts the reporting: where to send, and for which release */
export interface SentrySetup {
  dsn: string
  environment: string | null
  release: string
  /**
   * Whether the user feedback widget is offered (`SENTRY_FEEDBACK_ENABLED`):
   * the integration is added to the client, the button is mounted by the shell
   */
  feedbackEnabled: boolean
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

/** The id of the element the feedback widget adds to the body (SDK default) */
export const FEEDBACK_HOST_ID = 'sentry-feedback'

/** Tags every event: the DSN may be shared by several apps */
const APP_TAG = 'twake-mail'

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
    a.release === b.release &&
    a.feedbackEnabled === b.feedbackEnabled
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
 * session replay, profiling nor tracing, the feedback form only when the
 * deployment turns it on, and every event and breadcrumb is rebuilt by
 * `sentryEvents.ts`.
 */
export class SentryLifecycle {
  private readonly options: SentryLifecycleOptions
  private wanted: SentryReporting | null = null
  private running: SentryReporting | null = null
  private feedback: FeedbackIntegration | null = null
  private feedbackStarts = 0
  private queue: Promise<void> = Promise.resolve()
  private readonly listeners = new Set<() => void>()

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
   * Whether the SDK is started with the feedback integration: the shell can
   * mount the button. Meant for `useSyncExternalStore`, with `subscribe`.
   */
  isFeedbackRunning(): boolean {
    return this.running?.setup.feedbackEnabled === true
  }

  /**
   * Changes at every start with the feedback integration, 0 while it is not
   * running: the button, keyed by it, plugs itself again on the new form.
   * Meant for `useSyncExternalStore`, with `subscribe`.
   */
  feedbackGeneration(): number {
    return this.isFeedbackRunning() ? this.feedbackStarts : 0
  }

  /**
   * Plugs the feedback form on `el` (the button of the shell) and returns the
   * way to detach it, which also removes the form. The form handles the focus
   * as the dialogs of the app (`makeFeedbackFocus`). A no-op while the
   * feedback is not running.
   */
  attachFeedback(el: HTMLElement, labels: Partial<FeedbackLabels>): () => void {
    if (this.feedback === null) return () => undefined
    const { release, ...callbacks } = makeFeedbackFocus(el, FEEDBACK_HOST_ID)
    const detach = this.feedback.attachTo(el, { ...labels, ...callbacks })
    return () => {
      release()
      detach()
    }
  }

  /** Sets the colour scheme of the feedback form (no-op without feedback) */
  setFeedbackTheme(scheme: 'light' | 'dark' | 'system'): void {
    this.feedback?.setTheme(scheme)
  }

  /** Calls `listener` when the SDK starts or stops; returns the way to stop */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
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
    // The synchronous integration, bundled with the app: the lazy one loads
    // code from Sentry's CDN, which `script-src 'self'` refuses. No button of
    // its own: the shell mounts the one of `twake-feedback`, which plugs the
    // form on itself (`attachFeedback`). One per start: the SDK keeps the
    // client it is added to
    const feedback = setup.feedbackEnabled ? makeFeedbackIntegration() : null
    try {
      Sentry.init({
        dsn: setup.dsn,
        release: setup.release,
        ...(setup.environment ? { environment: setup.environment } : {}),
        initialScope: { tags: { app: APP_TAG } },
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
        // no profiling, no session replay, no logs, no release health
        // sessions: none of their integrations is added. The feedback one is
        // added only when the deployment turns it on
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
          Sentry.captureConsoleIntegration({ levels: ['error'] }),
          // `beforeSend` never sees a feedback: this is its gate and scrubbing
          {
            name: 'TwakeFeedbackGate',
            processEvent: event => {
              if (!isFeedbackEvent(event)) return event
              return this.isAllowed() ? scrubFeedbackEvent(event) : null
            }
          },
          ...(feedback ? [feedback] : [])
        ],
        beforeSend: (event, hint) =>
          this.isAllowed() ? scrubEvent(event, hint) : null,
        beforeBreadcrumb: breadcrumb =>
          this.isAllowed() ? scrubBreadcrumb(breadcrumb) : null
      })
      this.feedback = feedback
      if (feedback !== null) this.feedbackStarts += 1
      this.running = reporting
      this.moveUser(reporting)
      this.notify()
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
    const hadFeedback = this.isFeedbackRunning()
    this.running = null
    this.feedback = null
    this.notify()
    // The button detaches its form when it unmounts, but neither `close` nor
    // the `remove` of the integration takes the host of the form out of the
    // page (it looks for the parent of the shadow root, which has none), and
    // the next client would add a second one
    if (hadFeedback) {
      Sentry.getFeedback()?.remove()
      document.getElementById(FEEDBACK_HOST_ID)?.remove()
    }
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
