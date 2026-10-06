import * as Sentry from '@sentry/react'
import { useTheme } from '@linagora/twake-mui'
import { useEffect, useMemo, useSyncExternalStore } from 'react'

import { FLOATING_ACTION_INSET } from '@/ds/FloatingActionButton/FloatingActionButton'
import { placeFeedbackWidget } from '@/ds/FeedbackWidgetPlacement/placeFeedbackWidget'
import { FEEDBACK_HOST_ID, sentryLifecycle } from '@common/app/sentry'
import { useIsEmbedded } from '@common/features/embedding/embedding'
import { useI18n, type I18nApi } from '@common/i18n/useI18n'

function subscribe(listener: () => void): () => void {
  return sentryLifecycle.subscribe(listener)
}

function isFeedbackRunning(): boolean {
  return sentryLifecycle.isFeedbackRunning()
}

type FeedbackLabels = Parameters<
  NonNullable<ReturnType<typeof Sentry.getFeedback>>['createWidget']
>[0]

/** Every text of the widget, in the language of the app */
function makeLabels(t: I18nApi['t']): FeedbackLabels {
  return {
    triggerLabel: t('feedback.trigger'),
    triggerAriaLabel: t('feedback.triggerAria'),
    formTitle: t('feedback.formTitle'),
    messageLabel: t('feedback.messageLabel'),
    messagePlaceholder: t('feedback.messagePlaceholder'),
    emailLabel: t('feedback.emailLabel'),
    emailPlaceholder: t('feedback.emailPlaceholder'),
    submitButtonLabel: t('feedback.submit'),
    cancelButtonLabel: t('feedback.cancel'),
    confirmButtonLabel: t('feedback.confirm'),
    successMessageText: t('feedback.success'),
    isRequiredLabel: t('feedback.required'),
    addScreenshotButtonLabel: t('feedback.addScreenshot'),
    removeScreenshotButtonLabel: t('feedback.removeScreenshot'),
    highlightToolText: t('feedback.highlightTool'),
    hideToolText: t('feedback.hideTool'),
    removeHighlightText: t('feedback.removeHighlight'),
    errorEmptyMessageText: t('feedback.errorEmptyMessage'),
    errorNoClientText: t('feedback.errorNoClient'),
    errorTimeoutText: t('feedback.errorTimeout'),
    errorForbiddenText: t('feedback.errorForbidden'),
    errorGenericText: t('feedback.errorGeneric')
  }
}

export interface FeedbackWidgetProps {
  /** A floating button of the app is at the bottom right: stay above it */
  hasFloatingAction: boolean
}

/**
 * The floating "Send feedback" button of the standalone webmail (Sentry user
 * feedback). It exists only while the reporting is running with the feedback
 * integration, that is: the deployment turned it on and the user opted in to
 * error reporting. Never in the facade of a team mailbox (it does not mount
 * the shell) nor inside Twake Workplace: the container owns the feedback
 * there.
 */
export function FeedbackWidget({
  hasFloatingAction
}: FeedbackWidgetProps): null {
  const { t } = useI18n()
  const theme = useTheme()
  const isEmbedded = useIsEmbedded()
  const isRunning = useSyncExternalStore(subscribe, isFeedbackRunning)
  const isShown = isRunning && !isEmbedded
  const labels = useMemo(() => makeLabels(t), [t])
  const zIndex = theme.zIndex.speedDial
  const bottomClearance = hasFloatingAction ? FLOATING_ACTION_INSET : 0

  useEffect(() => {
    if (!isShown) return undefined
    const widget = Sentry.getFeedback()?.createWidget(labels)
    if (widget === undefined) return undefined
    return () => {
      widget.removeFromDom()
    }
  }, [isShown, labels])

  // After the widget is created, and again when what it must avoid changes
  useEffect(() => {
    if (!isShown) return
    const host = document.getElementById(FEEDBACK_HOST_ID)
    if (host) placeFeedbackWidget(host, { bottomClearance, zIndex })
  }, [isShown, labels, bottomClearance, zIndex])

  return null
}
