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

test.describe('AI composer assistant', () => {
  test('AI-01 the assistant translates what the user wrote; the answer is inserted', async ({
    page,
    user
  }) => {
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
    const asked: string[] = []
    await page.route(ENDPOINT, async route => {
      asked.push(route.request().postData() ?? '')
      await route.fulfill({
        json: { choices: [{ message: { role: 'assistant', content: 'Bonjour Bob' } }] }
      })
    })

    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.editor.click()
    await page.keyboard.type('Hello Bob')

    await composer.root.getByTestId('composer-scribe-button').click()
    await page.getByRole('menuitem', { name: 'French' }).click()
    const dialog = page.getByTestId('composer-scribe-dialog')
    await expect(dialog.getByRole('region', { name: 'Suggestion' })).toHaveText('Bonjour Bob')
    await expectNoA11yViolations(page)
    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain('Translate the text to French.')
    expect(asked[0]).toContain('Hello Bob')

    await dialog.getByRole('button', { name: 'Insert' }).click()
    await expect(dialog).toBeHidden()
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
    await expect(composer.root.getByTestId('composer-scribe-button')).toHaveCount(0)
  })
})
