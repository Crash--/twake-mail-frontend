import { test as base, expect } from '@playwright/test'

import { JmapClient } from './jmap'
import { type E2EUser, E2EUserFactory } from './users'
import { type Quota, WebAdminClient } from './webadmin'

/**
 * The fixtures every spec imports instead of `@playwright/test`:
 *
 *   import { test, expect } from '../support/fixtures';
 *
 *   test('MBX-05 switching folder shows its emails', async ({ page, user, jmap }) => { ... });
 */
export interface E2EFixtures {
  /** WebAdmin of the stack, for what the fixtures below do not cover */
  webadmin: WebAdminClient
  /** Creates more accounts (and team mailboxes); everything is deleted after the test */
  users: E2EUserFactory
  /** A brand new account, for this test only */
  user: E2EUser
  /** JMAP provisioning client authenticated as `user` */
  jmap: JmapClient
  /** JMAP provisioning client for any other account: `jmapFor(bob).sendEmail(...)` */
  jmapFor: (user: E2EUser) => JmapClient
}

export interface E2EOptions {
  /** Quota applied to `user`: `test.use({ userQuota: { count: 200, size: 50_000_000 } })` */
  userQuota: Quota | null
  /**
   * One row per email and the reading view of a single email, as with the "Thread" setting
   * off (conversations are on by default): `test.use({ emailsOneByOne: true })` for the specs
   * of that mode
   */
  emailsOneByOne: boolean
}

/** Where the app keeps the "Thread" setting (common/src/features/settings/threadPreference.ts) */
const THREAD_PREFERENCE_STORAGE_KEY = 'twake-mail.preferences.thread'

/**
 * Whether a console message is a violation of the Content-Security-Policy of the app (the
 * header of its Docker image, see docs/deployment.md), as Chromium logs it. The email body
 * frames add their own, stricter policy (common/src/features/email/emailBody.ts), whose
 * directives never allow 'self': remote content blocked there is the expected behaviour.
 */
function isAppCspViolation(text: string): boolean {
  if (!text.includes('Content Security Policy')) return false
  const directive = /directive:? "([^"]*)"/.exec(text)?.[1]
  return directive === undefined || directive.includes("'self'")
}

export const test = base.extend<E2EFixtures & E2EOptions>({
  userQuota: [null, { option: true }],
  emailsOneByOne: [false, { option: true }],

  page: async ({ page, emailsOneByOne }, use) => {
    if (emailsOneByOne) {
      await page.addInitScript(key => {
        window.localStorage.setItem(key, 'false')
      }, THREAD_PREFERENCE_STORAGE_KEY)
    }
    // The suite runs against the Docker image too (E2E_APP_IMAGE): whatever its security
    // headers block fails the test
    const cspViolations: string[] = []
    page.on('console', message => {
      if (isAppCspViolation(message.text())) cspViolations.push(message.text())
    })
    await use(page)
    expect(cspViolations, 'Content-Security-Policy violations').toEqual([])
  },

  // Playwright fixtures receive an empty destructuring pattern when they need no other fixture
  // eslint-disable-next-line no-empty-pattern
  webadmin: async ({}, use) => {
    await use(new WebAdminClient())
  },

  users: async ({ webadmin }, use, testInfo) => {
    const factory = new E2EUserFactory(webadmin)
    await use(factory)
    const failures = await factory.cleanup()
    if (failures.length > 0) {
      // Not fatal: the address is random and never reused. Surface it in the report.
      testInfo.annotations.push({
        type: 'cleanup-failure',
        description: failures.join('\n')
      })
    }
  },

  user: async ({ users, userQuota }, use) => {
    await use(
      await users.create(userQuota === null ? {} : { quota: userQuota })
    )
  },

  jmap: async ({ user }, use) => {
    await use(JmapClient.forUser(user))
  },

  // eslint-disable-next-line no-empty-pattern
  jmapFor: async ({}, use) => {
    await use((user: E2EUser) => JmapClient.forUser(user))
  }
})

export { expect }
export type { E2EUser }
