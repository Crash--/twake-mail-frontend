import { FeedbackButton, getFeedbackLabels } from '@linagora/twake-feedback'
import { useColorScheme } from '@linagora/twake-mui'
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactElement
} from 'react'

import { BelowDrawers } from '@/ds/BelowDrawers/BelowDrawers'
import { FLOATING_ACTION_INSET } from '@/ds/FloatingActionButton/FloatingActionButton'
import { LiveRegion } from '@/ds/LiveRegion/LiveRegion'
import { sentryLifecycle } from '@common/app/sentry'
import { useIsEmbedded } from '@common/features/embedding/embedding'
import { useI18n } from '@common/i18n/useI18n'

/** Key of the position of the button in the local storage of the browser */
const STORAGE_KEY = 'twake-mail'

/** How long "Thank you, your feedback has been sent." stays in the live region, in ms */
const SENT_ANNOUNCEMENT_MS = 5_000

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
 * the container owns the feedback there. Drawn below the drawers, the dialogs
 * and the composer: it must never cover one of their controls (the library
 * puts it above the modals). The confirmation of a sent feedback, which the
 * SDK shows without a live region, is announced through one of the app.
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
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (isShown) sentryLifecycle.setFeedbackTheme(colorScheme)
  }, [isShown, colorScheme])

  useEffect(() => {
    if (announcement === '') return
    const timer = setTimeout(() => {
      setAnnouncement('')
    }, SENT_ANNOUNCEMENT_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [announcement])

  // Memoized: a new function detaches the form and closes it if it is open
  const attach = useCallback(
    (el: HTMLElement) => {
      const labels = getFeedbackLabels(lang)
      return sentryLifecycle.attachFeedback(el, labels, () => {
        setAnnouncement(labels.successMessageText)
      })
    },
    [lang]
  )

  if (!isShown) return null
  return (
    <>
      <LiveRegion data-testid="feedback-announcement">
        {announcement}
      </LiveRegion>
      <BelowDrawers>
        <FeedbackButton
          key={generation}
          attach={attach}
          storageKey={STORAGE_KEY}
          bottomOffset={hasBottomAction ? FLOATING_ACTION_INSET : 0}
        />
      </BelowDrawers>
    </>
  )
}
