import type { Page } from '@playwright/test'

import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

/**
 * The AI assistant of the composer (tmail-flutter's scribe), against
 * doubles: tmail-backend advertises no assistant
 * (`com:linagora:params:jmap:aibot`), so the spec adds it to the JMAP
 * session and answers its endpoint itself. No text leaves the machine.
 */

const AIBOT = 'com:linagora:params:jmap:aibot'
const ENDPOINT = 'https://scribe.example.test/chat/completions'

async function offerAssistant(page: Page): Promise<void> {
  // The app reads the session from /.well-known/jmap (SERVER_URL), which
  // redirects to /jmap/session
  await page.route('**/{jmap/session,.well-known/jmap}', async route => {
    const response = await route.fetch()
    const session = (await response.json()) as {
      capabilities: Record<string, unknown>
      accounts: Record<string, { accountCapabilities: Record<string, unknown> }>
    }
    session.capabilities[AIBOT] = {}
    for (const account of Object.values(session.accounts)) {
      account.accountCapabilities[AIBOT] = { scribeEndpoint: ENDPOINT }
    }
    await route.fulfill({ response, json: session })
  })
}

test.describe('AI composer assistant', () => {
  test('AI-01 the assistant translates what the user wrote; the answer is inserted', async ({
    page,
    user
  }) => {
    await offerAssistant(page)
    const asked: string[] = []
    await page.route(ENDPOINT, async route => {
      asked.push(route.request().postData() ?? '')
      await route.fulfill({
        json: {
          choices: [{ message: { role: 'assistant', content: 'Bonjour Bob' } }]
        }
      })
    })

    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.editor.click()
    await page.keyboard.type('Hello Bob')

    await composer.root.getByTestId('composer-scribe-button').click()
    // As tmail-flutter: the languages open beside "Translate"
    await page.getByRole('menuitem', { name: 'Translate' }).click()
    await page.getByRole('menuitem', { name: 'French' }).click()
    const dialog = page.getByTestId('composer-scribe-dialog')
    await expect(dialog.getByRole('region', { name: 'Suggestion' })).toHaveText(
      'Bonjour Bob'
    )
    await expectNoA11yViolations(page)
    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain('Translate the text to French.')
    expect(asked[0]).toContain('Hello Bob')

    await dialog.getByRole('button', { name: 'Insert' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(composer.editor).toContainText('Bonjour Bob')
    await composer.deleteDraftButton.click()
  })

  test('AI-02 without the aibot capability the composer has no assistant', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()

    await expect(composer.editor).toBeVisible()
    await expect(
      composer.root.getByTestId('composer-scribe-button')
    ).toHaveCount(0)
  })

  test('AI-05 a button under the selection opens the assistant on it, and the answer is copied', async ({
    page,
    user,
    context
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await offerAssistant(page)
    await page.route(ENDPOINT, async route => {
      await route.fulfill({
        json: {
          choices: [{ message: { role: 'assistant', content: 'Bonjour Bob' } }]
        }
      })
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.editor.click()
    await page.keyboard.type('Hello Bob')
    await expect(
      page.getByTestId('composer-scribe-selection-button')
    ).toHaveCount(0)
    await page.keyboard.press('ControlOrMeta+a')

    await page.getByTestId('composer-scribe-selection-button').click()
    await page.getByRole('menuitem', { name: 'Translate' }).click()
    await page.getByRole('menuitem', { name: 'French' }).click()
    const dialog = page.getByTestId('composer-scribe-dialog')
    await expect(dialog.getByRole('region', { name: 'Suggestion' })).toHaveText(
      'Bonjour Bob'
    )
    await dialog.getByRole('button', { name: 'Copy' }).click()
    await expect(mailbox.toast).toContainText('Result copied to clipboard')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'Bonjour Bob'
    )

    await dialog.getByRole('button', { name: 'Replace' }).click()
    await expect(composer.editor).toContainText('Bonjour Bob')
    await expect(composer.editor).not.toContainText('Hello Bob')
    await composer.deleteDraftButton.click()
  })

  test('AI-07 with nothing written, the assistant offers "Help me write" alone, and writes from the prompt', async ({
    page,
    user
  }) => {
    await offerAssistant(page)
    const asked: string[] = []
    await page.route(ENDPOINT, async route => {
      asked.push(route.request().postData() ?? '')
      await route.fulfill({
        json: {
          choices: [{ message: { role: 'assistant', content: 'Hi Alice' } }]
        }
      })
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()

    await composer.root.getByTestId('composer-scribe-button').click()
    await expect(page.getByTestId('composer-scribe-actions')).toHaveCount(0)
    const prompt = page.getByRole('textbox', { name: 'Help me write' })
    await expect(prompt).toBeFocused()
    await expectNoA11yViolations(page)
    await prompt.fill('Greet Alice')
    await prompt.press('Enter')

    const dialog = page.getByRole('dialog', { name: 'Help me write' })
    await expect(dialog.getByRole('region', { name: 'Suggestion' })).toHaveText(
      'Hi Alice'
    )
    expect(asked[0]).toContain('Greet Alice')
    await dialog.getByRole('button', { name: 'Insert' }).click()
    await expect(composer.editor).toContainText('Hi Alice')
    await composer.deleteDraftButton.click()
  })

  test('AI-06 the AI Scribe preference hides the assistant of the composer', async ({
    page,
    user
  }) => {
    await offerAssistant(page)
    const mailbox = await new LoginPage(page).loginAs(user)
    const settings = await mailbox.openSettings()
    await settings.open('preferences')
    const toggle = page.getByRole('switch', { name: 'Enable AI Scribe' })
    await expect(toggle).toBeChecked()
    await toggle.click()
    await expect(toggle).not.toBeChecked()
    await settings.backToMail()

    const composer = await mailbox.compose()
    await expect(composer.editor).toBeVisible()
    await expect(
      composer.root.getByTestId('composer-scribe-button')
    ).toHaveCount(0)
    await composer.deleteDraftButton.click()
  })
})
