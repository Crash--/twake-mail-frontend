import { ComposerPage, ConversationPage, LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

test.describe('EML the reading view of the new design', () => {
  test.describe('a single email', () => {
    test.use({ emailsOneByOne: true })

    test('EML-38 the toolbar names the folder and moves to the previous and next email, the header has five icon buttons and the answers are in the bar at the bottom', async ({
      page,
      user,
      jmap
    }) => {
      await jmap.sendEmail({ to: user.email, subject: 'older', text: 'one' })
      await jmap.waitForEmail({ subject: 'older' })
      await jmap.sendEmail({
        to: user.email,
        subject: 'newer',
        text: 'two'
      })
      await jmap.waitForEmail({ subject: 'newer' })

      const mailbox = await new LoginPage(page).loginAs(user)
      const email = await mailbox.openEmail('newer')

      await expect(email.backButton).toHaveText('Inbox')
      await expect(email.backButton).toHaveAccessibleName('Back to Inbox')
      const actions = email.root.getByTestId('email-view-actions')
      await expect(actions.getByRole('button')).toHaveCount(5)
      await expect(
        actions.getByRole('button', { name: 'Reply', exact: true })
      ).toBeVisible()
      await expect(
        actions.getByRole('button', { name: 'Move message' })
      ).toBeVisible()
      await expect(actions.getByTestId('email-view-star-button')).toBeVisible()
      await expect(
        actions.getByRole('button', { name: 'Move to trash' })
      ).toBeVisible()
      await expect(email.moreButton).toBeVisible()
      // "To" with the names; as tmail-flutter, no chevron for one recipient
      await expect(
        email.root.getByTestId('email-view-recipients-toggle')
      ).toHaveCount(0)
      await expect(
        email.root.getByRole('group', { name: 'Reply actions' })
      ).toBeVisible()
      await expectNoA11yViolations(page)

      // "newer" heads the folder: only "next" is there, then only "previous"
      const previous = email.root.getByTestId('email-view-previous-button')
      const next = email.root.getByTestId('email-view-next-button')
      await expect(previous).toBeDisabled()
      await next.click()
      await email.expectSubject('older')
      await expect(next).toBeDisabled()
      await previous.click()
      await email.expectSubject('newer')

      // The bar at the bottom answers
      await email.root.getByTestId('reply-email-button').click()
      await expect(new ComposerPage(page).subjectInput).toHaveValue('Re: newer')
    })

    test(
      'EML-44 the recipients chevron follows the last address on its line, and a tap at the end of that address opens its card',
      { tag: '@mobile' },
      async ({ page, user, jmap }) => {
        await jmap.sendEmail({
          to: user.email,
          cc: [
            { email: 'quentin@example.com', name: 'Quentin Valmorinovski' },
            { email: 'frank@example.com', name: 'Frank Garnier-Dupontel' }
          ],
          subject: 'Long copy',
          text: 'Hello'
        })
        await jmap.waitForEmail({ subject: 'Long copy' })
        const mailbox = await new LoginPage(page).loginAs(user)
        const email = await mailbox.openEmail('Long copy')

        const last = email.addressButton(email.cc, 'Frank Garnier-Dupontel')
        const toggle = email.root.getByTestId('email-view-recipients-toggle')
        const lastBox = await last.boundingBox()
        const toggleBox = await toggle.boundingBox()
        expect(lastBox).not.toBeNull()
        expect(toggleBox).not.toBeNull()
        if (lastBox === null || toggleBox === null) return
        // On the line of the last address, centred on it
        expect(
          Math.abs(
            toggleBox.y +
              toggleBox.height / 2 -
              (lastBox.y + lastBox.height / 2)
          )
        ).toBeLessThan(2)

        // 3 px from the end of the address: its card, not the recipients
        // (the click fails if the target of the chevron covers that point)
        await last.click({
          position: { x: lastBox.width - 3, y: lastBox.height / 2 }
        })
        await expect(email.addressCard).toBeVisible()
        await expect(toggle).toHaveAttribute('aria-expanded', 'false')
      }
    )
  })

  test('THR-21 a conversation has its answers in a bar at the bottom, and the actions of a collapsed message in its row', async ({
    page,
    user,
    jmap,
    jmapFor,
    users
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    await jmapFor(bob).sendEmail({
      to: user.email,
      subject: 'Plans',
      text: 'first'
    })
    const first = await jmap.waitForEmail({ subject: 'Plans' })
    await jmap.setKeywords(first.id, { $seen: true })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.emailRow('Plans').click()
    const conversation = await new ConversationPage(page).expectLoaded('Plans')

    const message = conversation.messages.first()
    await expect(message.getByTestId('email-view-actions')).toBeVisible()
    await expect(
      conversation.root.getByRole('group', { name: 'Reply actions' })
    ).toBeVisible()
    await expect(conversation.toolbarMoreButton).toBeVisible()
    await expectNoA11yViolations(page)

    await conversation.root.getByTestId('reply-email-button').click()
    await expect(new ComposerPage(page).subjectInput).toHaveValue('Re: Plans')
  })
})
