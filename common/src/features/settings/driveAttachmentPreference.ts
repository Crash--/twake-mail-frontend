import { useCallback } from 'react'

import { createLocalPreference } from './localPreference'

/**
 * The "Drive attachment" preference of tmail-flutter (Settings >
 * Preferences, `DriveAttachmentConfig`): shows the Twake Drive button in
 * the composer. On by default, kept in this browser.
 */
export const DRIVE_ATTACHMENT_PREFERENCE_STORAGE_KEY =
  'twake-mail.preferences.driveAttachment'

export const driveAttachmentPreference = createLocalPreference<boolean>({
  key: DRIVE_ATTACHMENT_PREFERENCE_STORAGE_KEY,
  parse: raw => raw !== 'false',
  serialize: String
})

export interface DriveAttachmentPreference {
  isEnabled: boolean
  setEnabled: (isEnabled: boolean) => void
}

export function useDriveAttachmentPreference(): DriveAttachmentPreference {
  const isEnabled = driveAttachmentPreference.useValue()
  const setEnabled = useCallback((value: boolean) => {
    driveAttachmentPreference.write(value)
  }, [])
  return { isEnabled, setEnabled }
}
