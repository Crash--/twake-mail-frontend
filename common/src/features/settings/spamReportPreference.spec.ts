import {
  isSpamReportIntervalElapsed,
  SPAM_REPORT_INTERVAL_MS,
  SPAM_REPORT_PREFERENCE_STORAGE_KEY,
  spamReportPreference
} from './spamReportPreference'

function makeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    }
  }
}

describe('spam report preference', () => {
  it('is on and never dismissed by default, and reads what it stored', () => {
    const storage = makeStorage()
    expect(spamReportPreference.read(storage)).toEqual({
      isEnabled: true,
      lastDismissedAt: 0
    })

    spamReportPreference.write(
      { isEnabled: false, lastDismissedAt: 5 },
      storage
    )
    expect(spamReportPreference.read(storage)).toEqual({
      isEnabled: false,
      lastDismissedAt: 5
    })
  })

  it('falls back to the defaults on a broken entry', () => {
    const storage = makeStorage()
    storage.setItem(SPAM_REPORT_PREFERENCE_STORAGE_KEY, '{nope')
    expect(spamReportPreference.read(storage).isEnabled).toBe(true)
  })

  it('waits 24 hours after a dismissal, a day at most if the clock went back', () => {
    const now = 1_000_000_000_000
    expect(isSpamReportIntervalElapsed(0, now)).toBe(true)
    expect(isSpamReportIntervalElapsed(now - 1000, now)).toBe(false)
    expect(
      isSpamReportIntervalElapsed(now - SPAM_REPORT_INTERVAL_MS, now)
    ).toBe(true)
    expect(isSpamReportIntervalElapsed(now + 1000, now)).toBe(false)
    expect(
      isSpamReportIntervalElapsed(now + SPAM_REPORT_INTERVAL_MS + 1, now)
    ).toBe(true)
  })
})
