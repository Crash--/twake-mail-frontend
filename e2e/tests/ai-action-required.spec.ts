import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import type { Page } from '@playwright/test'

/**
 * The "Action required" folder and the label categorisation preference
 * (tmail-flutter `HandleAiNeedsActionExtension`), against doubles:
 * tmail-backend advertises no AI capability (`com:linagora:params:jmap:aibot`),
 * so the specs add it to the JMAP session with `page.route`. The setting
 * `ai.label-categorization.enabled` is stored by the real server.
 */

const AIBOT = 'com:linagora:params:jmap:aibot'
const SETTING = 'ai.label-categorization.enabled'

async function offerAi(page: Page): Promise<void> {
  await page.route('**/{jmap/session,.well-known/jmap}', async route => {
    const response = await route.fetch()
    const session = (await response.json()) as {
      capabilities: Record<string, unknown>
      accounts: Record<string, { accountCapabilities: Record<string, unknown> }>
    }
    session.capabilities[AIBOT] = {}
    for (const account of Object.values(session.accounts)) {
      account.accountCapabilities[AIBOT] = {}
    }
    await route.fulfill({ response, json: session })
  })
}

test.describe('AI action required', () => {
  test.use({ emailsOneByOne: true })

  test('AI-03 the label categorisation preference adds the Action required folder, its tag and its removal', async ({
    page,
    user,
    jmap,
    jmapFor,
    users
  }) => {
    await offerAi(page)
    const sender = jmapFor(await users.create())
    const subject = 'Please send the report'
    await sender.sendEmail({ to: user.email, subject, text: 'Deadline Friday' })
    const email = await jmap.waitForEmail({ subject, withoutSearch: true })
    await jmap.setKeywords(email.id, { 'needs-action': true })

    const mailbox = await new LoginPage(page).loginAs(user)
    const folder = page.getByTestId('mailbox-item').filter({
      hasText: 'Action required'
    })
    // Off by default: no folder yet
    await expect(page.getByTestId('mailbox-item').first()).toBeVisible()
    await expect(folder).toHaveCount(0)

    const settings = await mailbox.openSettings()
    await settings.open('preferences')
    const toggle = page.getByRole('switch', {
      name: 'Enable label categorisation'
    })
    await expect(toggle).not.toBeChecked()
    await expectNoA11yViolations(page)
    await toggle.click()
    await expect(toggle).toBeChecked()
    await expect
      .poll(async () => {
        const result = await jmap.call('Settings/get', { ids: null }, [
          'com:linagora:params:jmap:settings'
        ])
        return (result.list as { settings: Record<string, string> }[])[0]
          ?.settings
      })
      .toMatchObject({ [SETTING]: 'true' })
    await settings.backToMail()

    // After Starred, in the sidebar
    const names = page.getByTestId('mailbox-item-name')
    await expect(folder).toHaveCount(1)
    const starredIndex = (await names.allTextContents()).indexOf('Starred')
    await expect(names.nth(starredIndex + 1)).toHaveText('Action required')
    await folder.click()

    const row = page.getByTestId('email-list-item-subject').filter({
      hasText: subject
    })
    await expect(row).toBeVisible()
    await expect(page.getByTestId('action-required-tag')).toBeVisible()
    await expectNoA11yViolations(page)

    // Opened: the tag with its ×
    await row.click()
    await page
      .getByRole('button', { name: 'Remove the Action Required tag' })
      .click()
    await expect
      .poll(async () => (await jmap.getEmail(email.id)).keywords)
      .not.toHaveProperty('needs-action')

    // Switching the preference off removes the folder
    const again = await mailbox.openSettings()
    await again.open('preferences')
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    await again.backToMail()
    await expect(folder).toHaveCount(0)
  })

  test('AI-04 without the AI capability nothing AI shows, even with the setting on and the keyword set', async ({
    page,
    user,
    jmap,
    jmapFor,
    users
  }) => {
    const sender = jmapFor(await users.create())
    const subject = 'Please send the report'
    await sender.sendEmail({ to: user.email, subject, text: 'Deadline Friday' })
    const email = await jmap.waitForEmail({ subject, withoutSearch: true })
    await jmap.setKeywords(email.id, { 'needs-action': true })
    await jmap.call(
      'Settings/set',
      { update: { singleton: { [`settings/${SETTING}`]: 'true' } } },
      ['com:linagora:params:jmap:settings']
    )

    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(page.getByTestId('mailbox-item').first()).toBeVisible()
    await expect(page.getByText('Action required')).toHaveCount(0)
    // A reload would lose the session: navigate inside the app
    await page.evaluate(() => {
      window.history.pushState({}, '', '/action-required')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page).not.toHaveURL(/action-required/)

    await expect(
      page.getByTestId('email-list-item-subject').filter({ hasText: subject })
    ).toBeVisible()
    await expect(page.getByTestId('action-required-tag')).toHaveCount(0)

    const settings = await mailbox.openSettings()
    await settings.open('preferences')
    await expect(
      page.getByRole('switch', { name: 'Enable thread' })
    ).toBeVisible()
    await expect(
      page.getByRole('switch', { name: 'Enable label categorisation' })
    ).toHaveCount(0)
    await expect(
      page.getByRole('switch', { name: 'Enable AI Scribe' })
    ).toHaveCount(0)
  })
})
