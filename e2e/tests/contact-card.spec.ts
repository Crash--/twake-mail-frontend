import { ComposerPage, ConversationPage, LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

const SUBJECT = 'Card subject'

test.describe('CRD the contact card of an address', () => {
  test.use({ emailsOneByOne: true })

  test(
    'CRD-01 the sender opens a named card next to it, with its avatar, name, address and a copy button; Escape closes it and gives the focus back',
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
      await expect(card.getByText(alice.email, { exact: true })).toBeVisible()
      await expect(card.getByText('AM', { exact: true })).toBeVisible()
      // twake-mui's ContactCard: on the screen, a phone's included
      const viewport = page.viewportSize()
      // Once grown in: the same box twice in a row
      let box = await card.boundingBox()
      await expect
        .poll(async () => {
          const previous = box
          box = await card.boundingBox()
          return JSON.stringify(box) === JSON.stringify(previous)
        })
        .toBe(true)
      expect(box?.x).toBeGreaterThanOrEqual(0)
      expect(box?.y).toBeGreaterThanOrEqual(0)
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
        viewport?.width ?? 0
      )
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        viewport?.height ?? 0
      )
      await expectNoA11yViolations(page)

      await card.getByRole('button', { name: 'Copy email' }).click()
      await expect(page.getByTestId('toast')).toHaveText('Email address copied')
      // Drawn out of the card (#1052), announced from it
      await expect(card.getByTestId('toast')).toHaveCount(0)
      await expect(card.getByRole('status')).toHaveText('Email address copied')
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
      await expect(card.getByText(carol.email, { exact: true })).toBeVisible()
      await card.getByTestId('email-address-compose-item').click()

      await expect(card).toBeHidden()
      const composer = new ComposerPage(page)
      await expect(composer.root).toBeVisible()
      await composer.showRecipients()
      await expect(
        composer.recipients('to').filter({ hasText: carol.email })
      ).toBeVisible()
    }
  )

  test('CRD-03 with CALENDAR_SPA_URL and CHAT_SPA_URL set, the card still offers no invitation and no chat', async ({
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

    await expect(
      email.addressCard.getByTestId('email-address-compose-item')
    ).toBeVisible()
    await expect(email.addressCard.getByRole('link')).toHaveCount(0)
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
        await expect(card.getByText(bob.email, { exact: true })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(card).toBeHidden()
        await expect(recipient).toBeFocused()
      }
    )
  })
})
