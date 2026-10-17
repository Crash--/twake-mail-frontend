import { LoginPage, SearchPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

// Dragging is a pointer gesture of the desktop: the list rows and the tags
// of the fields (tmail-flutter drags them on the web only)
test.describe('CMP recipients dragged between fields', () => {
  test('CMP-103 a recipient dragged from To to Cc moves there, and Alt+ArrowUp brings it back', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.addRecipient('to', 'alice@example.com')
    await composer.addRecipient('to', 'bob@example.com')
    await composer.showField('cc')
    await composer.addRecipient('cc', 'bob@example.com')

    const alice = composer.recipients('to').filter({
      hasText: 'alice@example.com'
    })
    await alice.dragTo(composer.root.getByTestId('composer-cc-field'))

    await expect(composer.recipients('to')).toHaveText(['bob@example.com'])
    await expect(composer.recipients('cc')).toHaveText([
      'bob@example.com',
      'alice@example.com'
    ])

    // Already in Cc: it merges, and leaves To anyway
    await composer.recipients('to').first().dragTo(
      composer.root.getByTestId('composer-cc-field')
    )
    await expect(composer.recipients('to')).toHaveCount(0)
    await expect(composer.recipients('cc')).toHaveText([
      'bob@example.com',
      'alice@example.com'
    ])

    // The keyboard way: Alt+ArrowUp on a tag of Cc moves it up to To
    await composer.recipients('cc').last().focus()
    await page.keyboard.press('Alt+ArrowUp')
    await expect(composer.recipients('to')).toHaveText(['alice@example.com'])
    await expect(composer.recipients('cc')).toHaveText(['bob@example.com'])
    await expectNoA11yViolations(page)
  })

  test('CMP-104 an email dragged from the list onto To adds its sender', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    // From someone else: the user's own address is never a dropped sender
    const alice = await users.create({ prefix: 'alice' })
    await jmapFor(alice).sendEmail({
      to: user.email,
      subject: 'Dragged to the composer',
      text: 'Hi'
    })
    await jmap.waitForEmail({ subject: 'Dragged to the composer' })

    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    // From its start: the docked composer covers the middle of the row
    await mailbox
      .emailRow('Dragged to the composer')
      .dragTo(composer.root.getByTestId('composer-to-field'), {
        sourcePosition: { x: 160, y: 20 }
      })

    await expect(composer.recipients('to')).toHaveText([alice.email])
    // Still in the Inbox: a drop on a field moves nothing
    await expect(mailbox.emailRow('Dragged to the composer')).toBeVisible()
  })
})

test.describe('CMP addresses of an open email dragged to the composer', () => {
  test.use({ emailsOneByOne: true })

  test('CMP-107 the recipients of an open email dragged onto To and Bcc are added there, once', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    const carol = await users.create({ prefix: 'carol' })
    await jmap.sendEmail({
      to: [{ name: 'Bob Dupont', email: bob.email }],
      cc: [{ name: 'Carol Petit', email: carol.email }],
      saveTo: 'inbox',
      subject: 'Addresses to drag',
      text: 'hello'
    })
    await jmap.waitForEmail({ subject: 'Addresses to drag' })

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('Addresses to drag')
    const composer = await mailbox.compose()
    await composer.showField('bcc')

    const bobButton = email.addressButton(email.to, 'Bob Dupont')
    await bobButton.dragTo(composer.root.getByTestId('composer-to-field'))
    await expect(composer.recipients('to')).toHaveText([/Bob Dupont/])

    await email
      .addressButton(email.cc, 'Carol Petit')
      .dragTo(composer.root.getByTestId('composer-bcc-field'))
    await expect(composer.recipients('bcc')).toHaveText([/Carol Petit/])

    // Already in To: it is not added twice
    await bobButton.dragTo(composer.root.getByTestId('composer-to-field'))
    await expect(composer.recipients('to')).toHaveCount(1)
    // Copied, not moved: the email still shows them, and no card opened
    await expect(bobButton).toBeVisible()
    await expect(email.addressCard).toBeHidden()
  })
})

test.describe('SRCH addresses of the advanced search', () => {
  test('SRCH-18 From and To take tags, which drag from one to the other', async ({
    page,
    user
  }) => {
    await new LoginPage(page).loginAs(user)
    const search = new SearchPage(page)
    const dialog = await search.openAdvanced()
    const from = dialog.getByTestId('advanced-search-from-input')
    await from.fill('alice@example.com')
    await from.press('Enter')
    await from.fill('bob@example.com')
    await from.press('Enter')
    const tags = (field: 'from' | 'to') =>
      dialog
        .getByTestId(`advanced-search-${field}-field`)
        .getByTestId('advanced-search-address-chip')
    await expect(tags('from')).toHaveText([
      'alice@example.com',
      'bob@example.com'
    ])
    await expectNoA11yViolations(page)

    await tags('from')
      .filter({ hasText: 'bob@example.com' })
      .dragTo(dialog.getByTestId('advanced-search-to-field'))

    await expect(tags('from')).toHaveText(['alice@example.com'])
    await expect(tags('to')).toHaveText(['bob@example.com'])
    await search.advancedSubmitButton.click()
    await expect(page).toHaveURL(/from=alice%40example\.com/)
    await expect(page).toHaveURL(/to=bob%40example\.com/)
  })
})
