import { ComposerPage, ConversationPage, LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

const SUBJECT = 'Card subject'

test.describe('CRD the contact card of an address', () => {
  test.use({ emailsOneByOne: true })

  test(
    'CRD-01 the sender opens a named card with its avatar, name, address and a copy button; Escape closes it and gives the focus back (a bottom sheet on a phone)',
    { tag: '@mobile' },
    async ({ page, user, users, jmapFor }) => {
      const alice = await users.create({ prefix: 'alice' })
      await jmapFor(alice).sendEmail({
        from: { name: 'Alice Martin', email: alice.email },
        to: user.email,
        subject: SUBJECT,
        text: 'hello'
      })
      await page
        .context()
        .grantPermissions(['clipboard-read', 'clipboard-write'])
      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await mailbox.openEmail(SUBJECT)

      const sender = email.addressButton(email.from, 'Alice Martin')
      await expect(sender).toHaveAttribute('aria-haspopup', 'dialog')
      await sender.click()

      const card = page.getByRole('dialog', { name: 'Alice Martin' })
      await expect(card).toBeVisible()
      await expect(card.getByTestId('contact-card-address')).toHaveText(
        alice.email
      )
      await expect(card.getByText('AM', { exact: true })).toBeVisible()
      const viewport = page.viewportSize()
      if (viewport !== null && viewport.width < 600) {
        // A bottom sheet: as wide as the screen, resting on its bottom edge
        // once it has slid in
        await expect
          .poll(async () => {
            const box = await card.boundingBox()
            return (box?.y ?? 0) + (box?.height ?? 0)
          })
          .toBeCloseTo(viewport.height, 0)
        expect((await card.boundingBox())?.width).toBeCloseTo(viewport.width, 0)
      } else {
        expect((await card.boundingBox())?.width).toBeCloseTo(383, 0)
      }
      await expectNoA11yViolations(page)

      await card.getByRole('button', { name: 'Copy the email address' }).click()
      await expect(page.getByTestId('toast')).toHaveText('Email address copied')
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        alice.email
      )

      await page.keyboard.press('Escape')
      await expect(card).toBeHidden()
      await expect(sender).toBeFocused()
    }
  )

  test(
    'CRD-02 a recipient of To and of Cc opens its card, whose "Compose email" opens a message to it',
    { tag: '@mobile' },
    async ({ page, user, users, jmap }) => {
      const bob = await users.create({ prefix: 'bob' })
      const carol = await users.create({ prefix: 'carol' })
      await jmap.sendEmail({
        to: [{ name: 'Bob Dupont', email: bob.email }],
        cc: [{ name: 'Carol Petit', email: carol.email }],
        saveTo: 'inbox',
        subject: SUBJECT,
        text: 'hello'
      })
      await jmap.waitForEmail({ subject: SUBJECT })
      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await mailbox.openEmail(SUBJECT)

      await email.addressButton(email.to, 'Bob Dupont').click()
      await expect(
        page.getByRole('dialog', { name: 'Bob Dupont' })
      ).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(email.addressCard).toBeHidden()

      await email.addressButton(email.cc, 'Carol Petit').click()
      const card = page.getByRole('dialog', { name: 'Carol Petit' })
      await expect(card.getByTestId('contact-card-address')).toHaveText(
        carol.email
      )
      await card.getByTestId('email-address-compose-item').click()

      await expect(card).toBeHidden()
      const composer = new ComposerPage(page)
      await expect(composer.root).toBeVisible()
      await expect(
        composer.recipients('to').filter({ hasText: carol.email })
      ).toBeVisible()
    }
  )

  test('CRD-03 "Invite to an event" and "Chat" are links built from CALENDAR_SPA_URL and CHAT_SPA_URL', async ({
    page,
    user,
    users,
    jmapFor
  }) => {
    const alice = await users.create({ prefix: 'alice' })
    await jmapFor(alice).sendEmail({
      to: user.email,
      subject: SUBJECT,
      text: 'hello'
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail(SUBJECT)
    const local = alice.email.split('@')[0] ?? ''

    await email.from.getByTestId('email-address').click()
    const invite = email.addressCard.getByRole('link', {
      name: 'Invite to an event'
    })
    await expect(invite).toHaveAttribute(
      'href',
      `https://calendar.example.com/newEvent?attendee=${encodeURIComponent(alice.email)}`
    )
    await expect(invite).toHaveAttribute('target', '_blank')
    await expect(invite).toHaveAttribute('rel', /noopener/)
    await expect(
      email.addressCard.getByRole('link', { name: 'Chat' })
    ).toHaveAttribute('href', `https://chat.example.com/#/chat/@${local}`)
  })

  test('CRD-04 the focus stays in the card while tabbing, and the close button closes it', async ({
    page,
    user,
    users,
    jmapFor
  }) => {
    const alice = await users.create({ prefix: 'alice' })
    await jmapFor(alice).sendEmail({
      to: user.email,
      subject: SUBJECT,
      text: 'hello'
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail(SUBJECT)
    await email.from.getByTestId('email-address').click()
    const card = page.getByRole('dialog')
    await expect(card).toBeVisible()

    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press('Tab')
      await expect(card.locator(':focus')).toHaveCount(1)
    }

    await card.getByRole('button', { name: 'Close' }).click()
    await expect(card).toBeHidden()
    await expect(email.from.getByTestId('email-address')).toBeFocused()
  })

  test('CRD-05 without CALENDAR_SPA_URL and CHAT_SPA_URL the card offers no invitation and no chat', async ({
    page,
    user,
    users,
    jmapFor
  }) => {
    const alice = await users.create({ prefix: 'alice' })
    await jmapFor(alice).sendEmail({
      to: user.email,
      subject: SUBJECT,
      text: 'hello'
    })
    await page.route('**/.env.js', async route => {
      const response = await route.fetch()
      const body = (await response.text())
        .replace(/var CALENDAR_SPA_URL = .*/, '')
        .replace(/var CHAT_SPA_URL = .*/, '')
      await route.fulfill({ response, body })
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail(SUBJECT)

    await email.from.getByTestId('email-address').click()

    await expect(
      email.addressCard.getByTestId('email-address-compose-item')
    ).toBeVisible()
    await expect(email.addressCard.getByRole('link')).toHaveCount(0)
  })

  test.describe('in a conversation', () => {
    test.use({ emailsOneByOne: false })

    test(
      'CRD-06 a recipient of an expanded message of a conversation opens its card too, and its line wraps as text',
      { tag: '@mobile' },
      async ({ page, user, users, jmap }) => {
        const bob = await users.create({ prefix: 'bob' })
        await jmap.sendEmail({
          to: [{ name: 'Bob Dupont', email: bob.email }],
          saveTo: 'inbox',
          subject: SUBJECT,
          text: 'hello'
        })
        await jmap.waitForEmail({ subject: SUBJECT })
        const mailbox = await new LoginPage(page).loginAs(user)
        await mailbox.emailRow(SUBJECT).click()
        const conversation = await new ConversationPage(page).expectLoaded(
          SUBJECT
        )
        const message = conversation.messages.first()

        const recipient = message
          .getByTestId('conversation-message-to')
          .getByTestId('email-address')
        await recipient.click()

        const card = page.getByRole('dialog', { name: 'Bob Dupont' })
        await expect(card.getByTestId('contact-card-address')).toHaveText(
          bob.email
        )
        await page.keyboard.press('Escape')
        await expect(card).toBeHidden()
        await expect(recipient).toBeFocused()
      }
    )
  })
})
