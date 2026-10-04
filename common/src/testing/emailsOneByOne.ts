import { THREAD_PREFERENCE_STORAGE_KEY } from '@common/features/settings/threadPreference'

/**
 * For the specs of a describe block written for one email per row and the
 * reading view of a single email: turns conversations (on by default) off
 * around each test
 */
export function listEmailsOneByOne(): void {
  beforeEach(() => {
    window.localStorage.setItem(THREAD_PREFERENCE_STORAGE_KEY, 'false')
  })
  afterEach(() => {
    window.localStorage.removeItem(THREAD_PREFERENCE_STORAGE_KEY)
  })
}
