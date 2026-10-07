import type { IntentService } from 'cozy-interapp'
import { useEffect, useRef, type ReactElement } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { ErrorScreen } from '@/ds/ErrorScreen/ErrorScreen'
import { FullPageLoader } from '@common/components/FullPageLoader'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import { ComposeIntentPage } from './ComposeIntentPage'
import { isComposeIntent, parseComposeData } from './composeIntent'
import { checkFrameAncestors, readAncestorOrigins } from './frameAncestors'
import { useIntentService, type IntentServiceError } from './useIntentService'

/** What the page says when it cannot serve the intent */
export type IntentMessage =
  | IntentServiceError
  | 'sessionExpired'
  | 'unsupported'
  | 'invalidData'
  | 'untrustedFrame'

const MESSAGES: Record<
  IntentMessage,
  { title: TranslationKey; description: TranslationKey }
> = {
  unavailable: {
    title: 'intents.unavailable.title',
    description: 'intents.unavailable.description'
  },
  forbidden: {
    title: 'intents.forbidden.title',
    description: 'intents.forbidden.description'
  },
  failed: {
    title: 'intents.failed.title',
    description: 'intents.failed.description'
  },
  sessionExpired: {
    title: 'intents.sessionExpired.title',
    description: 'intents.sessionExpired.description'
  },
  unsupported: {
    title: 'intents.unsupported.title',
    description: 'intents.unsupported.description'
  },
  invalidData: {
    title: 'intents.invalidData.title',
    description: 'intents.invalidData.description'
  },
  untrustedFrame: {
    title: 'intents.untrustedFrame.title',
    description: 'intents.untrustedFrame.description'
  }
}

/** `sessionExpired` → `session-expired`, for the test ids */
function kebabCase(text: string): string {
  return text.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
}

export interface IntentMessageScreenProps {
  message: IntentMessage
}

/**
 * Why the intent cannot be served, in the frame: the app that framed it
 * keeps its own close button
 */
export function IntentMessageScreen({
  message
}: IntentMessageScreenProps): ReactElement {
  const { t } = useI18n()
  const { title, description } = MESSAGES[message]

  return (
    <ErrorScreen
      title={t(title)}
      description={t(description)}
      data-testid={`intent-error-${kebabCase(message)}`}
    />
  )
}

/** The client gets the error; called again, it is ignored */
function failIntent(service: IntentService, error: Error): void {
  try {
    service.throw(error)
  } catch {
    // Already answered
  }
}

/** Cancels the intent; called again, it is ignored */
function cancelIntent(service: IntentService): void {
  try {
    service.cancel()
  } catch {
    // Already answered
  }
}

interface RejectedIntentProps {
  service: IntentService
  message: 'unsupported' | 'invalidData' | 'untrustedFrame'
  /** What the client gets; null: the intent is cancelled */
  error: string | null
}

/** Tells the client the intent fails or is cancelled, and the user why */
function RejectedIntent({
  service,
  message,
  error
}: RejectedIntentProps): ReactElement {
  const answeredRef = useRef(false)

  useEffect(() => {
    if (answeredRef.current) return
    answeredRef.current = true
    if (error === null) cancelIntent(service)
    else failIntent(service, new Error(error))
  }, [service, error])

  return <IntentMessageScreen message={message} />
}

export interface IntentPageProps {
  intentId: string
}

/**
 * The `/intents?intent=<id>` page: the service of an intent another app
 * (Twake Chat…) started with cozy-interapp. Twake Mail serves one:
 * `CREATE io.cozy.mails`, a new message (`composeIntent.ts`).
 */
export function IntentPage({ intentId }: IntentPageProps): ReactElement {
  const state = useIntentService(intentId)

  if (state.status === 'loading') return <FullPageLoader />
  if (state.status === 'failed') {
    return <IntentMessageScreen message={state.error} />
  }

  const { service } = state
  const { action, type, frameAncestors } = service.getIntent().attributes
  // The client answered the handshake: is the page framed by it only?
  if (
    checkFrameAncestors(frameAncestors, readAncestorOrigins()) === 'untrusted'
  ) {
    return (
      <RejectedIntent service={service} message="untrustedFrame" error={null} />
    )
  }
  if (!isComposeIntent(action, type)) {
    return (
      <RejectedIntent
        service={service}
        message="unsupported"
        error={`Twake Mail does not handle ${action} ${type}`}
      />
    )
  }
  const fields = parseComposeData(service.getData())
  if (fields === null) {
    return (
      <RejectedIntent
        service={service}
        message="invalidData"
        error="The data of the new message has another shape"
      />
    )
  }
  return (
    <ErrorBoundary
      fallback={<IntentMessageScreen message="failed" />}
      onError={error => {
        console.error('[intents] The composer failed', error)
        // Nothing of the error leaves the app
        failIntent(service, new Error('The composer of Twake Mail failed'))
      }}
    >
      <ComposeIntentPage service={service} fields={fields} />
    </ErrorBoundary>
  )
}
