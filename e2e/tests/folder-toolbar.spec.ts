import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

test.describe('FBAR folder action bar', () => {
  test(
    'FBAR-01 the inbox offers refresh, select all and the three filters (the filter in the bar below the desktop size)',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await jmap.sendEmail({ to: user.email, subject: 'First', text: 'Hi' })
      await jmap.waitForEmail({ subject: 'First' })
      const mailbox = await new LoginPage(page).loginAs(user)

      if (['mobile', 'tablet'].includes(test.info().project.name)) {
        // As tmail-flutter below the desktop size: no toolbar above the
        // list, the filter in the bar, the avatar selects its row
        await expect(page.getByTestId('list-toolbar')).toHaveCount(0)
        await page.getByTestId('top-bar').getByTestId('list-filter-button').click()
        await expect(
          page.getByTestId('list-filter-menu').getByRole('menuitemradio')
        ).toHaveCount(3)
        await expectNoA11yViolations(page)
        await page.keyboard.press('Escape')

        await mailbox.selectEmail('First')
        await expect(mailbox.selectionToolbar).toContainText('1 selected')
        await expectNoA11yViolations(page)
        return
      }
      const toolbar = page.getByTestId('list-toolbar')
      await expect(toolbar).toBeVisible()
      await expect(toolbar.getByTestId('list-refresh-button')).toBeVisible()
      await expect(toolbar.getByTestId('list-select-all-button')).toBeVisible()
      await expect(
        toolbar.getByTestId('recover-deleted-messages-button')
      ).toHaveCount(0)
      await page.getByTestId('list-filter-button').click()
      await expect(
        page.getByTestId('list-filter-menu').getByRole('menuitemradio')
      ).toHaveCount(3)
      await expectNoA11yViolations(page)
      await page.keyboard.press('Escape')

      await toolbar.getByTestId('list-select-all-button').click()
      await expect(mailbox.selectionToolbar).toBeVisible()
      await expect(mailbox.selectionToolbar).toContainText('1 selected')
      await expectNoA11yViolations(page)
    }
  )

  test(
    'FBAR-02 a filter narrows the folder in place, one at a time, with a toast and a clear button',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await jmap.sendEmail({
        to: user.email,
        subject: 'Already read',
        text: 'Hi'
      })
      await jmap.sendEmail({
        to: user.email,
        subject: 'Still unread',
        text: 'Hi'
      })
      const read = await jmap.waitForEmail({ subject: 'Already read' })
      await jmap.waitForEmail({ subject: 'Still unread' })
      await jmap.setKeywords(read.id, { $seen: true })
      const mailbox = await new LoginPage(page).loginAs(user)
      await expect(mailbox.emailRow('Already read')).toBeVisible()
      const url = page.url()

      await mailbox.applyQuickFilter('unread')

      await expect(mailbox.emailRow('Still unread')).toBeVisible()
      await expect(mailbox.emailRow('Already read')).toHaveCount(0)
      await expect(mailbox.toast).toContainText(
        'You’ve filtered messages by "Unread"'
      )
      // Still the folder, not a search
      expect(page.url()).toBe(url)
      await expect(page.getByTestId('list-filter-clear-button')).toBeVisible()
      await expectNoA11yViolations(page)

      // Picking the active filter clears it
      await mailbox.applyQuickFilter('unread')
      await expect(mailbox.emailRow('Already read')).toBeVisible()
      await expect(mailbox.toast).toContainText(
        'You’ve disabled filtered messages'
      )

      await mailbox.applyQuickFilter('unread')
      await expect(mailbox.emailRow('Already read')).toHaveCount(0)
      await page.getByTestId('list-filter-clear-button').click()
      await expect(mailbox.emailRow('Already read')).toBeVisible()
      await expect(page.getByTestId('list-filter-clear-button')).toHaveCount(0)
    }
  )

  test('FBAR-03 a read email leaves the filtered folder when it is moved away, a new one joins it', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'Unread one', text: 'Hi' })
    await jmap.waitForEmail({ subject: 'Unread one' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.applyQuickFilter('unread')
    await expect(mailbox.emailRow('Unread one')).toBeVisible()

    await jmap.sendEmail({ to: user.email, subject: 'Unread two', text: 'Hi' })

    await expect(mailbox.emailRow('Unread two')).toBeVisible()
    await mailbox.emailRow('Unread one').hover()
    await mailbox
      .emailRow('Unread one')
      .getByTestId('email-list-item-remove')
      .click()
    await expect(mailbox.emailRow('Unread one')).toHaveCount(0)
    await expect(mailbox.emailRow('Unread two')).toBeVisible()
  })

  test('FBAR-06 an email marked as read leaves the Unread filter at once', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'Read me', text: 'Hi' })
    await jmap.sendEmail({ to: user.email, subject: 'Keep me', text: 'Hi' })
    await jmap.waitForEmail({ subject: 'Read me' })
    await jmap.waitForEmail({ subject: 'Keep me' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.applyQuickFilter('unread')
    await expect(mailbox.emailRow('Read me')).toBeVisible()

    await mailbox.emailRow('Read me').hover()
    await mailbox
      .emailRow('Read me')
      .getByTestId('email-list-item-toggle-seen')
      .click()

    await expect(mailbox.emailRow('Read me')).toHaveCount(0)
    await expect(mailbox.emailRow('Keep me')).toBeVisible()
  })

  test('FBAR-04 the Trash has its banner and the filter, an empty Spam has neither select all nor filter', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'Binned',
      text: 'Hi',
      saveTo: 'trash'
    })
    const trash = await jmap.findMailboxByRole('trash')
    await expect
      .poll(
        async () => (await jmap.queryEmails({ inMailbox: trash.id })).length
      )
      .toBeGreaterThan(0)
    const mailbox = await new LoginPage(page).loginAs(user)

    await mailbox.openFolder({ role: 'trash' })
    await expect(mailbox.emailRow('Binned')).toBeVisible()
    await expect(mailbox.emptyTrashBanner).toBeVisible()
    await expect(page.getByTestId('list-filter-button')).toBeVisible()
    const session = await jmap.getSession()
    const hasVault =
      'com:linagora:params:jmap:messages:vault' in session.capabilities
    await expect(
      page.getByTestId('recover-deleted-messages-button')
    ).toHaveCount(hasVault ? 1 : 0)
    await expectNoA11yViolations(page)

    await mailbox.openFolder({ role: 'junk' })
    await expect(mailbox.emptyListView).toBeVisible()
    await expect(page.getByTestId('list-toolbar')).toBeVisible()
    await expect(page.getByTestId('list-refresh-button')).toBeVisible()
    await expect(page.getByTestId('list-select-all-button')).toHaveCount(0)
    await expect(page.getByTestId('list-filter-button')).toHaveCount(0)
  })

  test('FBAR-05 Starred has no starred filter, a label view has all three, search results have their own filters', async ({
    page,
    user,
    jmap
  }) => {
    const label = await jmap.createLabel('Design', '#1f9d3a')
    await jmap.sendEmail({ to: user.email, subject: 'Marked', text: 'Hi' })
    const email = await jmap.waitForEmail({ subject: 'Marked' })
    await jmap.setKeywords(email.id, { $flagged: true, [label.keyword]: true })
    const mailbox = await new LoginPage(page).loginAs(user)

    await page
      .locator('[data-mailbox-role="favorite"]')
      .getByRole('link')
      .click()
    await expect(mailbox.emailRow('Marked').first()).toBeVisible()
    await page.getByTestId('list-filter-button').click()
    await expect(page.getByTestId('quick-filter-unread')).toBeVisible()
    await expect(page.getByTestId('quick-filter-attachments')).toBeVisible()
    await expect(page.getByTestId('quick-filter-starred')).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.getByRole('link', { name: 'Design' }).first().click()
    // From every folder: the copy in Sent too
    await expect(mailbox.emailRow('Marked').first()).toBeVisible()
    await page.getByTestId('list-filter-button').click()
    await expect(
      page.getByTestId('list-filter-menu').getByRole('menuitemradio')
    ).toHaveCount(3)
    await page.keyboard.press('Escape')

    await page.getByTestId('search-input').fill('Marked')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('search-filters-bar')).toBeVisible()
    await expect(page.getByTestId('list-filter-button')).toHaveCount(0)
    await expect(page.getByTestId('list-refresh-button')).toBeVisible()
    await expectNoA11yViolations(page)
  })
})
