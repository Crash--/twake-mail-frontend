import { createLocalPreference } from '@common/features/settings/localPreference'

/**
 * Settings > Preferences: a notification of the system, and a sound, when
 * an email reaches the Inbox (not in tmail-flutter's web version). Off by
 * default, kept in this browser.
 */
export const newMailNotificationPreference = createLocalPreference<boolean>({
  key: 'twake-mail.preferences.newMailNotifications',
  parse: raw => raw === 'true',
  serialize: String
})

export const newMailSoundPreference = createLocalPreference<boolean>({
  key: 'twake-mail.preferences.newMailSound',
  parse: raw => raw === 'true',
  serialize: String
})

/** Whether the browser shows the notifications of this page */
export function canNotify(): boolean {
  return (
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  )
}

/**
 * Turns the notifications on, asking the browser first: called from the
 * click on the switch, as the browser asks for a user gesture. Resolves
 * whether they are on.
 */
export async function enableNewMailNotifications(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission
  const isOn = permission === 'granted'
  newMailNotificationPreference.write(isOn)
  return isOn
}
