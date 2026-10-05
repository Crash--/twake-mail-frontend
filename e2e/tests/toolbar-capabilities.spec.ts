import { ComposerPage, LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import type { Page } from '@playwright/test'

/**
 * The toolbar and top bar buttons that depend on what the server
 * advertises: the recovery of deleted messages (vault) in the personal
 * Trash, and the help button (contact support). The session is rewritten at
 * the network level, so that each case holds whatever the stack offers.
 */

const VAULT = 'com:linagora:params:jmap:messages:vault'
const SUPPORT = 'com:linagora:params:jmap:contact:support'

type Capabilities = Record<string, unknown>

/**
 * Sets (a value) or removes (`null`) capabilities in the JMAP session the
 * app reads from /.well-known/jmap, which redirects to /jmap/session
 */
async function stubCapabilities(
  page: Page,
  capabilities: Capabilities
): Promise<void> {
  await page.route('**/{jmap/session,.well-known/jmap}', async route => {
    const response = await route.fetch()
    const session = (await response.json()) as {
      capabilities: Capabilities
      accounts: Record<string, { accountCapabilities: Capabilities }>
    }
    for (const [uri, value] of Object.entries(capabilities)) {
      if (value === null) {
        delete session.capabilities[uri]
      } else {
        session.capabilities[uri] = value
      }
      for (const account of Object.values(session.accounts)) {
        if (value === null) {
          delete account.accountCapabilities[uri]
        } else {
          account.accountCapabilities[uri] = value
        }
      }
    }
    await route.fulfill({ response, json: session })
  })
}

test.describe('TBAR toolbar buttons that depend on the server', () => {
  test('TBAR-01 with the vault, the personal Trash has a button recovering deleted messages', async ({
    page,
    user
  }) => {
    await stubCapabilities(page, { [VAULT]: {} })
    const mailbox = await new LoginPage(page).loginAs(user)

    await expect(
      page.getByTestId('recover-deleted-messages-button')
    ).toHaveCount(0)
    await mailbox.openFolder({ role: 'trash' })
    const button = page.getByTestId('recover-deleted-messages-button')
    await expect(button).toBeVisible()
    await expect(button).toHaveAccessibleName('Recover deleted messages')
    await button.click()
    const dialog = page.getByTestId('recovery-dialog')
    await expect(dialog).toBeVisible()
    await expectNoA11yViolations(page)
    await dialog.getByTestId('recovery-cancel-button').click()
    await expect(dialog).toBeHidden()
  })

  test('TBAR-02 without the vault, the Trash has no recovery button', async ({
    page,
    user
  }) => {
    await stubCapabilities(page, { [VAULT]: null })
    const mailbox = await new LoginPage(page).loginAs(user)

    await mailbox.openFolder({ role: 'trash' })
    await expect(page.getByTestId('list-toolbar')).toBeVisible()
    await expect(
      page.getByTestId('recover-deleted-messages-button')
    ).toHaveCount(0)
  })

  test('TBAR-03 a support address makes the help button write to it', async ({
    page,
    user
  }) => {
    await stubCapabilities(page, {
      [SUPPORT]: { supportMailAddress: 'support@example.test' }
    })
    await new LoginPage(page).loginAs(user)

    const help = page.getByTestId('help-button')
    await expect(help).toHaveAccessibleName('Get help or report a bug')
    await help.click()
    const composer = new ComposerPage(page)
    await expect(composer.root).toContainText('support@example.test')
    await composer.deleteDraftButton.click()
  })

  test('TBAR-04 a support web page makes the help button a link to it, in a new tab', async ({
    page,
    user
  }) => {
    await stubCapabilities(page, {
      [SUPPORT]: { httpLink: 'https://support.example.test/help' }
    })
    await new LoginPage(page).loginAs(user)

    const help = page.getByTestId('help-button')
    await expect(help).toHaveAttribute(
      'href',
      'https://support.example.test/help'
    )
    await expect(help).toHaveAttribute('target', '_blank')
    await expectNoA11yViolations(page)
  })

  test('TBAR-05 without a support contact there is no help button', async ({
    page,
    user
  }) => {
    await stubCapabilities(page, { [SUPPORT]: null })
    await new LoginPage(page).loginAs(user)

    await expect(page.getByTestId('top-bar')).toBeVisible()
    await expect(page.getByTestId('help-button')).toHaveCount(0)
  })
})
