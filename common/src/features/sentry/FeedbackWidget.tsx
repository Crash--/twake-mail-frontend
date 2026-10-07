import { FeedbackButton, getFeedbackLabels } from '@linagora/twake-feedback'
import { useColorScheme } from '@linagora/twake-mui'
import {
  useCallback,
  useEffect,
  useSyncExternalStore,
  type ReactElement
} from 'react'

import { FLOATING_ACTION_INSET } from '@/ds/FloatingActionButton/FloatingActionButton'
import { sentryLifecycle } from '@common/app/sentry'
import { useIsEmbedded } from '@common/features/embedding/embedding'
import { useI18n } from '@common/i18n/useI18n'

/** Key of the position of the button in the local storage of the browser */
const STORAGE_KEY = 'twake-mail'

function subscribe(listener: () => void): () => void {
  return sentryLifecycle.subscribe(listener)
}

function getFeedbackGeneration(): number {
  return sentryLifecycle.feedbackGeneration()
}

export interface FeedbackWidgetProps {
  /**
   * Something of the app is at the bottom of the screen, the floating
   * "New message" button or the reply bar of an open email: stay above it
   */
  hasBottomAction: boolean
}

/**
 * The draggable "Something wrong?" button of the standalone webmail (the shared
 * `@linagora/twake-feedback`, Sentry user feedback). It exists only while the
 * reporting is running with the feedback integration, that is: the deployment
 * turned it on and the user opted in to error reporting. Never in the facade
 * of a team mailbox (it does not mount the shell) nor inside Twake Workplace:
 * the container owns the feedback there.
 */
export function FeedbackWidget({
  hasBottomAction
}: FeedbackWidgetProps): ReactElement | null {
  const { lang } = useI18n()
  const { colorScheme = 'system' } = useColorScheme()
  const isEmbedded = useIsEmbedded()
  // A new generation is a new form after a restart: the keyed button attaches
  // to it again
  const generation = useSyncExternalStore(subscribe, getFeedbackGeneration)
  const isShown = generation > 0 && !isEmbedded

  useEffect(() => {
    if (isShown) sentryLifecycle.setFeedbackTheme(colorScheme)
  }, [isShown, colorScheme])

  // Memoized: a new function detaches the form and closes it if it is open
  const attach = useCallback(
    (el: HTMLElement) =>
      sentryLifecycle.attachFeedback(el, getFeedbackLabels(lang)),
    [lang]
  )

  if (!isShown) return null
  return (
    <FeedbackButton
      key={generation}
      attach={attach}
      storageKey={STORAGE_KEY}
      bottomOffset={hasBottomAction ? FLOATING_ACTION_INSET : 0}
    />
  )
}
