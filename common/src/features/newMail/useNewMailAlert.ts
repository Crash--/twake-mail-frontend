import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'

import { formatAddressName } from '@common/features/email/addresses'
import { useI18n } from '@common/i18n/useI18n'

import {
  canNotify,
  newMailNotificationPreference,
  newMailSoundPreference
} from './newMailPreferences'
import type { NewEmail } from './newMailWatcher'

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
  setTimeout(() => {
    void context.close().catch(() => undefined)
  }, 1000)
}

/**
 * What to do when emails reach the Inbox: the sound and the notifications
 * the user turned on (Settings > Preferences), the notifications only while
 * the page is hidden. One tab of the account alerts, the one holding the
 * lock: each tab gets the same push.
 */
export function useNewMailAlert(
  accountId: string
): (emails: readonly NewEmail[]) => void {
  const { t } = useI18n()
  const navigate = useNavigate()
  const isLeader = useRef(false)

  useEffect(() => {
    // ponytail: without Web Locks (old browsers), every tab alerts
    if (typeof navigator.locks === 'undefined') {
      isLeader.current = true
      return
    }
    const released = new AbortController()
    navigator.locks
      .request(
        `twake-mail-new-mail-alert:${accountId}`,
        { signal: released.signal },
        () =>
          new Promise<void>(resolve => {
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
  }, [accountId])

  return useCallback(
    (emails: readonly NewEmail[]) => {
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
        document.visibilityState === 'visible'
      ) {
        return
      }
      for (const email of emails) {
        const sender = email.from?.[0]
        const subject = email.subject?.trim() ?? ''
        const notification = new Notification(
          sender ? formatAddressName(sender) : t('newMail.unknownSender'),
          {
            tag: email.id,
            body: subject === '' ? t('composer.template.noSubject') : subject
          }
        )
        notification.onclick = () => {
          window.focus()
          void navigate(
            `/mailbox/${encodeURIComponent(email.inboxId)}/email/${encodeURIComponent(email.id)}`
          )
          notification.close()
        }
      }
    },
    [navigate, t]
  )
}
