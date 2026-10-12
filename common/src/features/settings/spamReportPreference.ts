import { useCallback } from 'react'

import { createLocalPreference } from './localPreference'

/**
 * The "Spam reports" preference of tmail-flutter (Settings > Preferences,
 * `SpamReportConfig`): the banner reminding the unread spam, and when it
 * was last shown and dismissed. All on this device, in one entry as in
 * tmail-flutter.
 */
export const SPAM_REPORT_PREFERENCE_STORAGE_KEY =
  'twake-mail.preferences.spamReport'

/**
 * The banner comes back after this delay once shown or dismissed
 * (`spamReportBannerDisplayIntervalInHours`)
 */
export const SPAM_REPORT_INTERVAL_MS = 24 * 60 * 60 * 1000

export interface SpamReportConfig {
  isEnabled: boolean
  /** Epoch ms, 0 when never dismissed */
  lastDismissedAt: number
  /** Epoch ms, 0 when never shown */
  lastShownAt: number
}

const INITIAL_CONFIG: SpamReportConfig = {
  isEnabled: true,
  lastDismissedAt: 0,
  lastShownAt: 0
}

function parseTimestamp(value: unknown): number {
  return typeof value === 'number' && value > 0 ? value : 0
}

function parseConfig(raw: string | null): SpamReportConfig {
  if (raw === null) return INITIAL_CONFIG
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return INITIAL_CONFIG
    const stored = value as Record<string, unknown>
    return {
      isEnabled: stored.isEnabled !== false,
      lastDismissedAt: parseTimestamp(stored.lastDismissedAt),
      lastShownAt: parseTimestamp(stored.lastShownAt)
    }
  } catch {
    return INITIAL_CONFIG
  }
}

export const spamReportPreference = createLocalPreference<SpamReportConfig>({
  key: SPAM_REPORT_PREFERENCE_STORAGE_KEY,
  parse: parseConfig,
  serialize: config => JSON.stringify(config)
})

/**
 * Whether the banner may show: not within 24 hours of the last dismissal
 * or display (one in the future, a clock set back, counts for a day at
 * most), as tmail-flutter's `GetSpamMailboxCachedInteractor`
 */
export function isSpamReportIntervalElapsed(
  lastEventAt: number,
  now: number
): boolean {
  if (lastEventAt <= 0) return true
  const elapsed = now - lastEventAt
  if (elapsed < 0) return Math.abs(elapsed) >= SPAM_REPORT_INTERVAL_MS
  return elapsed >= SPAM_REPORT_INTERVAL_MS
}

export interface SpamReportPreference extends SpamReportConfig {
  setEnabled: (isEnabled: boolean) => void
  /** Hides the banner for 24 hours */
  dismiss: () => void
  /** Records that the banner showed: it does not come back for 24 hours */
  markShown: () => void
}

export function useSpamReportPreference(): SpamReportPreference {
  const config = spamReportPreference.useValue()
  const setEnabled = useCallback((isEnabled: boolean) => {
    spamReportPreference.write({
      ...spamReportPreference.read(),
      isEnabled
    })
  }, [])
  const dismiss = useCallback(() => {
    spamReportPreference.write({
      ...spamReportPreference.read(),
      lastDismissedAt: Date.now()
    })
  }, [])
  const markShown = useCallback(() => {
    spamReportPreference.write({
      ...spamReportPreference.read(),
      lastShownAt: Date.now()
    })
  }, [])
  return { ...config, setEnabled, dismiss, markShown }
}
