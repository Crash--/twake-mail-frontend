import { LoginPage, SearchPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

test.describe('KBD keyboard shortcuts', () => {
  // The reading view of a single email: the "Thread" setting off
  test.use({ emailsOneByOne: true })

  test('KBD-01 move between emails, archive, undo, star and leave unread with single keys', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'older', text: 'one' })
    await jmap.waitForEmail({ subject: 'older' })
    await jmap.sendEmail({ to: user.email, subject: 'newer', text: 'two' })
    const newer = await jmap.waitForEmail({ subject: 'newer' })
    const archive = await jmap.findMailboxByRole('archive')
    const inbox = await jmap.findMailboxByRole('inbox')

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.emailRowLink('newer').focus()
    await page.keyboard.press('j')
    await expect(mailbox.emailRowLink('older')).toBeFocused()
    await page.keyboard.press('k')
    await expect(mailbox.emailRowLink('newer')).toBeFocused()

    await page.keyboard.press('e')

    await expect(mailbox.emailRow('newer')).toBeHidden()
    await expect(mailbox.toast).toContainText('Moved to Archive')
    await expect(mailbox.emailRowLink('older')).toBeFocused()
    await expect
      .poll(async () => Object.keys((await jmap.getEmail(newer.id)).mailboxIds))
      .toEqual([archive.id])
    await expectNoA11yViolations(page)

    await page.keyboard.press('z')

    await expect(mailbox.emailRow('newer')).toBeVisible()
    await expect
      .poll(async () => Object.keys((await jmap.getEmail(newer.id)).mailboxIds))
      .toEqual([inbox.id])

    const email = await mailbox.openEmail('newer')
    await page.keyboard.press('s')
    await expect.poll(async () => (await jmap.getEmail(newer.id)).keywords).toMatchObject({
      $flagged: true
    })
    await page.keyboard.press('u')
    await expect(email.root).toBeHidden()
    await expect(mailbox.emailRow('newer')).toHaveAttribute('data-unread', 'true')
    await expect
      .poll(async () => '$seen' in (await jmap.getEmail(newer.id)).keywords)
      .toBe(false)
  })

  test('KBD-02 "?" lists the shortcuts, which can be turned off for good', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'stays here', text: 'one' })
    await jmap.waitForEmail({ subject: 'stays here' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.emailRowLink('stays here').focus()
    await page.keyboard.press('?')

    await expect(mailbox.shortcutsDialog).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toContainText(
      'Archive message'
    )
    await expectNoA11yViolations(page)
    await page.getByRole('switch', { name: 'Enable keyboard shortcuts' }).click()
    await page.keyboard.press('Escape')
    await expect(mailbox.shortcutsDialog).toBeHidden()
    await expect(mailbox.emailRowLink('stays here')).toBeFocused()

    // Basic credentials live in memory: sign in again, the setting stays
    await page.reload()
    await new LoginPage(page).loginAs(user)
    await mailbox.emailRowLink('stays here').focus()
    await page.keyboard.press('e')
    await page.keyboard.press('?')

    await expect(mailbox.shortcutsDialog).toBeHidden()
    await expect(mailbox.emailRow('stays here')).toBeVisible()
    await expect(mailbox.toast).toBeHidden()
  })

  test(
    'KBD-06 "/" reaches the search, unfolding it on phones; Escape gives the focus back',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await jmap.sendEmail({ to: user.email, subject: 'find me', text: 'one' })
      await jmap.waitForEmail({ subject: 'find me' })

      const mailbox = await new LoginPage(page).loginAs(user)
      const search = new SearchPage(page)
      await mailbox.emailRowLink('find me').focus()
      await page.keyboard.press('/')

      await expect(search.input).toBeFocused()
      await expect(search.input).toHaveValue('')
      await expectNoA11yViolations(page)

      if (search.isPhone()) {
        // The first Escape closes the suggestions, the second folds the field
        await page.keyboard.press('Escape')
        await page.keyboard.press('Escape')
        await expect(search.input).toBeHidden()
        await expect(search.openButton).toBeFocused()
      }
    }
  )
})
