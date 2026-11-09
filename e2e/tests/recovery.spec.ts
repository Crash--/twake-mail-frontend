import { LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'

test.describe('MBX recovery and quota', () => {
  test('MBX-64 Enter in a field starts the recovery', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.runFolderAction({ role: 'trash' }, 'recover-deleted-messages')
    const dialog = page.getByTestId('recovery-dialog')
    await dialog.getByTestId('recovery-subject-input').fill('by enter')
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
  })

  test('MBX-11 emails emptied from the Trash come back in "Recovered"', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'Recover me',
      text: 'x',
      saveTo: 'trash'
    })
    await jmap.waitForEmail({ subject: 'Recover me', mailboxRole: 'trash' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'trash' })
    await mailbox.emptyTrashBanner
      .getByRole('button', { name: 'Empty Trash now' })
      .click()
    await mailbox.confirmDialog
      .getByTestId('confirm-dialog-confirm-button')
      .click()
    await expect(mailbox.emptyTrashBanner).toBeHidden()

    await mailbox.runFolderAction({ role: 'trash' }, 'recover-deleted-messages')
    const dialog = page.getByTestId('recovery-dialog')
    await expect(dialog).toContainText(
      'You can recover messages deleted within the last 15 days.'
    )
    await expectNoA11yViolations(page)
    await dialog.getByTestId('recovery-restore-button').click()

    await expect(mailbox.toast).toContainText(/messages? recovered/)
    await page.getByTestId('recovery-open-button').click()
    await expect(mailbox.emailRow('Recover me')).toBeVisible()
    await mailbox.expectFolderSelected({ name: 'Recovered' })
  })

  test('MBX-62 a custom range of deletion dates, refused out of the horizon, recovers the emails deleted in it', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'Recover my range',
      text: 'x',
      saveTo: 'trash'
    })
    await jmap.waitForEmail({
      subject: 'Recover my range',
      mailboxRole: 'trash'
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'trash' })
    await mailbox.emptyTrashBanner
      .getByRole('button', { name: 'Empty Trash now' })
      .click()
    await mailbox.confirmDialog
      .getByTestId('confirm-dialog-confirm-button')
      .click()
    await expect(mailbox.emptyTrashBanner).toBeHidden()

    await mailbox.runFolderAction({ role: 'trash' }, 'recover-deleted-messages')
    const dialog = page.getByTestId('recovery-dialog')
    const deletion = dialog.getByTestId('recovery-deletion-select')
    await expect(deletion).toHaveAccessibleName('Deletion date')
    await expect(deletion).toHaveText('Last 7 days')

    // The reception periods, with the keyboard: a listbox, Escape closes it
    const reception = dialog.getByTestId('recovery-reception-select')
    await reception.focus()
    await page.keyboard.press('Enter')
    const listbox = page.getByRole('listbox', { name: 'Reception date' })
    await expect(listbox.getByRole('option')).toHaveText([
      'All time',
      'Last 7 days',
      'Last 30 days',
      'Last 6 months',
      'Last 1 year',
      'Custom range'
    ])
    await expectNoA11yViolations(page)
    await page.keyboard.press('Escape')
    await expect(listbox).toBeHidden()
    await expect(reception).toBeFocused()

    // The deletion periods within the 15 days of the vault
    await deletion.click()
    await expect(
      page.getByRole('listbox', { name: 'Deletion date' }).getByRole('option')
    ).toHaveText(['Last 7 days', 'Last 15 days', 'Custom range'])
    await page.getByRole('option', { name: 'Custom range' }).click()
    const range = page.getByTestId('recovery-range-dialog')
    await expect(range).toBeVisible()
    const start = range.getByTestId('recovery-range-start-input')
    const end = range.getByTestId('recovery-range-end-input')
    const setDate = range.getByTestId('recovery-range-confirm-button')

    await setDate.click()
    await expect(start).toHaveAccessibleDescription(
      'The start date cannot be null.'
    )
    await expect(start).toBeFocused()
    await expectNoA11yViolations(page)

    const day = async (daysAgo: number): Promise<string> =>
      page.evaluate(back => {
        const now = new Date()
        const date = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - back
        )
        const pad = (value: number): string => String(value).padStart(2, '0')
        return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
      }, daysAgo)
    const today = await day(0)
    await start.fill(await day(30))
    await end.fill(today)
    await setDate.click()
    await expect(start).toHaveAccessibleDescription(
      `The start date cannot be before ${await day(15)}.`
    )
    await start.fill(today)
    await end.fill(await day(1))
    await setDate.click()
    await expect(end).toHaveAccessibleDescription(
      'The end time cannot be less than the start time.'
    )
    // As tmail-flutter: the quick ranges and two months to pick from
    await range.getByRole('button', { name: 'Last 7 days' }).click()
    await expect(start).toHaveValue(await day(7))
    await expect(end).toHaveValue(today)
    await expect(range.getByRole('grid')).toHaveCount(2)
    await expectNoA11yViolations(page)
    const todayCell = range.locator('[role="gridcell"][aria-current="date"]')
    await todayCell.click()
    await expect(start).toHaveValue(today)
    await expect(end).toHaveValue('')
    await todayCell.click()
    await expect(end).toHaveValue(today)
    await setDate.click()
    await expect(range).toBeHidden()
    await expect(deletion).toHaveText(`From ${today} to ${today}`)
    await expect(deletion).toBeFocused()

    const sent = page.waitForRequest(
      request =>
        request.method() === 'POST' &&
        (request.postData() ?? '').includes('"EmailRecoveryAction/set"')
    )
    await dialog.getByTestId('recovery-restore-button').click()
    const body = (await sent).postDataJSON() as {
      methodCalls: [
        string,
        { create?: Record<string, Record<string, unknown>> }
      ][]
    }
    const criteria = body.methodCalls.find(
      ([name]) => name === 'EmailRecoveryAction/set'
    )?.[1].create?.recovery
    expect(Object.keys(criteria ?? {}).sort()).toEqual([
      'deletedAfter',
      'deletedBefore'
    ])
    await expect(mailbox.toast).toContainText(/messages? recovered/)
    await page.getByTestId('recovery-open-button').click()
    await expect(mailbox.emailRow('Recover my range')).toBeVisible()
  })

  test('MBX-13 emails emptied from Spam are recovered from the Trash', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'junk mail',
      text: 'x',
      saveTo: 'junk'
    })
    await jmap.waitForEmail({ subject: 'junk mail', mailboxRole: 'junk' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'junk' })
    await mailbox.emptyTrashBanner
      .getByRole('button', { name: 'Delete all spam emails now' })
      .click()
    await mailbox.confirmDialog
      .getByRole('button', { name: 'Delete all' })
      .click()
    await expect(mailbox.emptyTrashBanner).toBeHidden()

    await mailbox.runFolderAction({ role: 'trash' }, 'recover-deleted-messages')
    await page
      .getByTestId('recovery-dialog')
      .getByTestId('recovery-restore-button')
      .click()
    await page.getByTestId('recovery-open-button').click()
    await expect(mailbox.emailRow('junk mail')).toBeVisible()
  })

  test('MBX-14 emails emptied from the Spam menu are recovered from the Trash', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'more junk',
      text: 'x',
      saveTo: 'junk'
    })
    await jmap.waitForEmail({ subject: 'more junk', mailboxRole: 'junk' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.runFolderAction({ role: 'junk' }, 'empty-spam')
    await mailbox.confirmDialog
      .getByRole('button', { name: 'Delete all' })
      .click()
    await expect(mailbox.toast).toContainText(
      'All messages have been deleted forever'
    )

    await mailbox.runFolderAction({ role: 'trash' }, 'recover-deleted-messages')
    await page
      .getByTestId('recovery-dialog')
      .getByTestId('recovery-restore-button')
      .click()
    await page.getByTestId('recovery-open-button').click()
    await expect(mailbox.emailRow('more junk')).toBeVisible()
  })

  test.describe('quota', () => {
    test.use({ userQuota: { count: 200, size: 50_000_000 } })

    test('MBX-18 the storage used grows with an email sent with an attachment', async ({
      page,
      user,
      jmap
    }) => {
      const mailbox = await new LoginPage(page).loginAs(user)
      // As tmail-flutter, the sidebar shows the storage past 80 % only
      await expect(page.getByTestId('quota-indicator')).toHaveCount(0)
      const settings = await mailbox.openSettings()
      await settings.open('storage')
      const storage = page.getByTestId('storage-settings')
      await expect(storage).toContainText('of 50 MB used')
      await expect(storage).toContainText('Available:')
      const before = Number(await storage.getAttribute('data-used'))

      await jmap.sendEmail({
        to: user.email,
        subject: 'With a file',
        text: 'x',
        attachments: [
          { name: 'notes.txt', type: 'text/plain', content: 'x'.repeat(20_000) }
        ]
      })
      await jmap.waitForEmail({ subject: 'With a file' })

      // Push brings the new quota
      await expect
        .poll(async () => Number(await storage.getAttribute('data-used')))
        .toBeGreaterThan(before)
      await expectNoA11yViolations(page)
    })
  })
})
