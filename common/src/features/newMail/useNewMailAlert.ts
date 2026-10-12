import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'

import { formatAddressName } from '@common/features/email/addresses'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  canNotify,
  newMailNotificationPreference,
  newMailSoundPreference
} from './newMailPreferences'
import type { NewEmail } from './newMailWatcher'
import {
  confirmWebPush,
  getPushRegistration,
  syncWebPush,
  type PushWorkerMessage
} from './webPush'

/** What a notification of a new email says: its sender and its subject */
export function describeNewEmail(
  email: NewEmail,
  t: (key: 'newMail.unknownSender' | 'composer.template.noSubject') => string
): { title: string; body: string } {
  const sender = email.from?.[0]
  const subject = email.subject?.trim() ?? ''
  return {
    title: sender ? formatAddressName(sender) : t('newMail.unknownSender'),
    body: subject === '' ? t('composer.template.noSubject') : subject
  }
}

/** A short two-note chime, drawn by the browser: no sound file to serve */
function playChime(): void {
  if (typeof AudioContext === 'undefined') return
  const context = new AudioContext()
  const gain = context.createGain()
  gain.connect(context.destination)
  const start = context.currentTime
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5)
  for (const [frequency, at] of [
    [880, 0],
    [1320, 0.12]
  ] as const) {
    const oscillator = context.createOscillator()
    oscillator.frequency.value = frequency
    oscillator.connect(gain)
    oscillator.start(start + at)
    oscillator.stop(start + 0.5)
  }
  if (context.state === 'suspended') {
    // The browser keeps the sound of a tab never clicked on (autoplay)
    console.warn('[new mail] The sound waits for a click on this tab')
  }
  setTimeout(() => {
    void context.close().catch(() => undefined)
  }, 1000)
}

/**
 * What to do when emails reach the Inbox: the sound and the notifications
 * the user turned on (Settings > Preferences), the notifications only while
 * the page is hidden or not focused. One tab of the account alerts, the one
 * holding the lock: each tab gets the same push. Pages that do not alert
 * (`isEnabled` false, as the facades framed by Twake Space) never take it.
 *
 * The app alone (`scope` `page`) also keeps the web push of the browser in
 * line with the notifications switch (`syncWebPush`), so that the server
 * wakes the service worker with every tab closed. Its notifications then go
 * through the worker, which opens the email on a click.
 */
export interface NewMailAlert {
  /** Resolves once the notifications are shown */
  alert: (emails: readonly NewEmail[]) => Promise<void>
  /** This tab shows the notifications of the new emails */
  notifies: () => boolean
  /** This tab alerts, and the user turned the sound or notifications on */
  isWanted: () => boolean
  /** This page holds the lock of the alerts of the account */
  isLeader: () => boolean
}

export function useNewMailAlert(
  accountId: string,
  isEnabled: boolean,
  /** The pages that share one lock: the app alone, or its frames in Space */
  scope: 'page' | 'space' = 'page'
): NewMailAlert {
  const { t } = useI18n()
  const navigate = useNavigate()
  const client = useJmapClient()
  const { session } = useJmapSession()
  const isLeader = useRef(false)
  const hasWebPush = isEnabled && scope === 'page'
  const isNotifying = newMailNotificationPreference.useValue() && canNotify()
  const pushTitle = t('newMail.pushTitle')
  const pushBody = t('newMail.pushBody')

  useEffect(() => {
    if (!hasWebPush) return
    syncWebPush(client, session, isNotifying, {
      title: pushTitle,
      body: pushBody
    }).catch((error: unknown) => {
      console.warn('[web push] Cannot set the subscription', error)
    })
  }, [client, session, hasWebPush, isNotifying, pushTitle, pushBody])

  useEffect(() => {
    if (!hasWebPush || !('serviceWorker' in navigator)) return
    const handleMessage = (event: MessageEvent<PushWorkerMessage>): void => {
      const message = event.data
      if (message.type === 'twake-mail-push-verification') {
        confirmWebPush(
          client,
          message.pushSubscriptionId,
          message.verificationCode
        ).catch((error: unknown) => {
          console.warn('[web push] Cannot confirm the subscription', error)
        })
      }
      // A notification clicked: its email, an in-app path
      if (message.type === 'twake-mail-open' && message.url.startsWith('/')) {
        void navigate(message.url)
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [client, hasWebPush, navigate])

  useEffect(() => {
    if (!isEnabled) return
    // ponytail: without Web Locks (old browsers), every tab alerts
    if (typeof navigator.locks === 'undefined') {
      isLeader.current = true
      return
    }
    const released = new AbortController()
    navigator.locks
      .request(
        `twake-mail-new-mail-alert:${scope}:${accountId}`,
        { signal: released.signal },
        () =>
          new Promise<void>(resolve => {
            if (released.signal.aborted) {
              resolve()
              return
            }
            isLeader.current = true
            released.signal.addEventListener('abort', () => {
              resolve()
            })
          })
      )
      .catch(() => undefined)
    return () => {
      isLeader.current = false
      released.abort()
    }
  }, [accountId, isEnabled, scope])

  const isWanted = useCallback(
    (): boolean =>
      isLeader.current &&
      (newMailSoundPreference.read() ||
        (newMailNotificationPreference.read() && canNotify())),
    []
  )

  const notifies = useCallback(
    (): boolean =>
      isLeader.current && newMailNotificationPreference.read() && canNotify(),
    []
  )

  const alert = useCallback(
    async (emails: readonly NewEmail[]): Promise<void> => {
      if (!isLeader.current) return
      if (newMailSoundPreference.read()) {
        try {
          playChime()
        } catch (error: unknown) {
          console.warn('[new mail] Cannot play the sound', error)
        }
      }
      if (
        !newMailNotificationPreference.read() ||
        !canNotify() ||
        // ponytail: the leader judges by its own page; another tab of the
        // app may be the one in front (share the focus between tabs if so)
        (document.visibilityState === 'visible' && document.hasFocus())
      ) {
        return
      }
      // Through the worker when there is one: it then knows a notification
      // is shown for the push it got, and handles the click
      const registration = await getPushRegistration().catch(() => null)
      for (const email of emails) {
        const { title, body } = describeNewEmail(email, t)
        const url = `/mailbox/${encodeURIComponent(email.inboxId)}/email/${encodeURIComponent(email.id)}`
        if (registration !== null) {
          await registration.showNotification(title, {
            tag: email.id,
            body,
            data: { url }
          })
          continue
        }
        const notification = new Notification(title, { tag: email.id, body })
        notification.onclick = () => {
          window.focus()
          void navigate(url)
          notification.close()
        }
      }
    },
    [navigate, t]
  )

  const isLeaderNow = useCallback((): boolean => isLeader.current, [])

  return { alert, notifies, isWanted, isLeader: isLeaderNow }
}
