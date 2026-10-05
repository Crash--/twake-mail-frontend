import { ConversationPage, LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

/**
 * The warnings the backend puts on an email with `X-TWP-Message` headers
 * (issue #142, contract of tmail-flutter#4639), imported as raw messages.
 */

const SUSPICIOUS_SENDER =
  'This email is from an external sender immitating known users, double check the mail address.'

test.describe('TWP warnings of the backend', () => {
  test.use({ emailsOneByOne: true })

  test(
    'TWP-01 a known code shows its localized text in a banner between the header and the body',
    { tag: '@mobile' },
    async ({ page, user, users, jmap }) => {
      const bob = await users.create({ prefix: 'bob' })
      await jmap.importEml('twp_warnings/one-warning.eml', 'inbox', {
        replace: { BOB_ADDRESS: bob.email, USER_ADDRESS: user.email }
      })

      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await mailbox.openEmail('Flagged by the backend')

      const banner = email.root.getByTestId('twp-warning-0')
      await expect(banner).toContainText(SUSPICIOUS_SENDER)
      await expect(banner).toHaveAccessibleName(
        'Information: About this message'
      )
      await expect(email.root.getByTestId('twp-warnings')).toHaveCount(1)
      await expect(email.body()).toContainText('Body of the flagged message.')
      // Info: the sender keeps its avatar
      await expect(
        email.root.getByTestId('email-view-danger-badge')
      ).toHaveCount(0)
      await expectNoA11yViolations(page)
    }
  )

  test(
    'TWP-02 several headers stack in order, an error replaces the avatar by a badge',
    { tag: '@mobile' },
    async ({ page, user, users, jmap }) => {
      const bob = await users.create({ prefix: 'bob' })
      await jmap.importEml('twp_warnings/two-warnings.eml', 'inbox', {
        replace: { BOB_ADDRESS: bob.email, USER_ADDRESS: user.email }
      })

      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await mailbox.openEmail('Two warnings')

      const banners = email.root.getByTestId(/^twp-warning-\d$/)
      await expect(banners).toHaveCount(2)
      await expect(banners.nth(0)).toContainText('This email is having virus')
      await expect(banners.nth(0)).toHaveAccessibleName(/^Warning: /)
      await expect(banners.nth(1)).toContainText(
        'that we removed for your security'
      )
      await expect(banners.nth(1)).toHaveAccessibleName(
        'Danger: This message may be dangerous'
      )
      await expect(
        email.root.getByRole('img', { name: 'Dangerous message' })
      ).toBeVisible()
      await expectNoA11yViolations(page)
    }
  )

  test('TWP-03 an unknown code shows the text of the server as plain text', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    await jmap.importEml('twp_warnings/unknown-warning.eml', 'inbox', {
      replace: { BOB_ADDRESS: bob.email, USER_ADDRESS: user.email }
    })

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('Unknown warning')

    const banner = email.root.getByTestId('twp-warning-0')
    await expect(banner).toContainText(
      'Server says <b>careful</b> https://evil.example/ now.'
    )
    await expect(banner.locator('a, b')).toHaveCount(0)
  })

  test(
    'TWP-04 a dismissed warning stays dismissed after a reload, the others stay',
    { tag: '@mobile' },
    async ({ page, user, users, jmap }) => {
      const bob = await users.create({ prefix: 'bob' })
      const imported = await jmap.importEml(
        'twp_warnings/two-warnings.eml',
        'inbox',
        {
          replace: { BOB_ADDRESS: bob.email, USER_ADDRESS: user.email }
        }
      )

      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await mailbox.openEmail('Two warnings')
      await email.root.getByTestId('twp-warning-dismiss-1').click()

      await expect(email.root.getByTestId('twp-warning-1')).toHaveCount(0)
      await expect(email.root.getByTestId('twp-warning-0')).toBeVisible()
      await expect(
        email.root.getByTestId('email-view-danger-badge')
      ).toHaveCount(0)
      await expect
        .poll(async () => (await jmap.getEmail(imported.id)).keywords)
        .toHaveProperty('twp-warning-dismissed-1', true)

      // Basic credentials live in memory: sign in again, the keyword stays
      await page.reload()
      await new LoginPage(page).loginAs(user)
      await expect(email.subject).toHaveText('Two warnings')
      await expect(email.root.getByTestId('twp-warning-0')).toBeVisible()
      await expect(email.root.getByTestId('twp-warning-1')).toHaveCount(0)
      await expectNoA11yViolations(page)
    }
  )

  test('TWP-05 an error in Spam offers Not spam, which moves the email to the Inbox', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    const imported = await jmap.importEml(
      'twp_warnings/dangerous.eml',
      'junk',
      {
        replace: { BOB_ADDRESS: bob.email, USER_ADDRESS: user.email }
      }
    )

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'junk' })
    const email = await mailbox.openEmail('Dangerous message')
    await email.root.getByTestId('twp-warning-not-spam-0').click()

    const inbox = await jmap.findMailboxByRole('inbox')
    await expect
      .poll(async () => (await jmap.getEmail(imported.id)).mailboxIds)
      .toEqual({ [inbox.id]: true })
  })

  test('TWP-06 an error in the Inbox shows no Not spam', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    await jmap.importEml('twp_warnings/dangerous.eml', 'inbox', {
      replace: { BOB_ADDRESS: bob.email, USER_ADDRESS: user.email }
    })

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('Dangerous message')

    await expect(email.root.getByTestId('twp-warning-0')).toBeVisible()
    await expect(email.root.getByTestId('twp-warning-not-spam-0')).toHaveCount(
      0
    )
  })
})

test.describe('TWP warnings in a conversation', () => {
  test('TWP-07 the banners show in the expanded message that has them', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    await jmap.importEml('twp_warnings/two-warnings.eml', 'inbox', {
      replace: { BOB_ADDRESS: bob.email, USER_ADDRESS: user.email }
    })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.emailRowLink('Two warnings').click()
    const conversation = await new ConversationPage(page).expectLoaded(
      'Two warnings'
    )

    const message = conversation.message(/Bob/)
    await expect(message.getByTestId(/^twp-warning-\d$/)).toHaveCount(2)
    await expect(
      message.getByTestId('conversation-message-danger-badge')
    ).toBeVisible()
    await expectNoA11yViolations(page)
  })
})
