import { ComposerPage, ConversationPage, LoginPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { addReplyInInbox } from '../support/conversation'
import { expect, test } from '../support/fixtures'

test.describe('LST email list rows', () => {
  test('LST-01 a row with labels stays on one line, chips before the subject', async ({
    page,
    user,
    jmap
  }) => {
    const label = await jmap.createLabel('Design', '#1f9d3a')
    await jmap.sendEmail({
      to: user.email,
      subject: 'Labelled row',
      text: 'A body that gives the row a preview'
    })
    const email = await jmap.waitForEmail({ subject: 'Labelled row' })
    await jmap.setKeywords(email.id, { [label.keyword]: true })
    const mailbox = await new LoginPage(page).loginAs(user)
    const row = mailbox.emailRow('Labelled row')
    await expect(row.getByTestId('label-chip')).toBeVisible()

    const viewport = page.viewportSize()
    test.skip(
      viewport === null || viewport.width < 1000,
      'compact rows have several lines'
    )
    const rowBox = await row.boundingBox()
    const chipBox = await row.getByTestId('label-chip').boundingBox()
    const subjectBox = await row
      .getByTestId('email-list-item-subject')
      .boundingBox()
    const previewBox = await row
      .getByTestId('email-list-item-preview')
      .boundingBox()
    expect(rowBox?.height).toBeLessThan(60)
    expect(chipBox?.x).toBeLessThan(subjectBox?.x ?? 0)
    expect(Math.abs((chipBox?.y ?? 0) - (subjectBox?.y ?? 99))).toBeLessThan(12)
    expect(Math.abs((previewBox?.y ?? 0) - (subjectBox?.y ?? 99))).toBeLessThan(
      8
    )
    await expectNoA11yViolations(page)
  })

  test('LST-02 the actions replace the date on hover and on keyboard focus', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'Hover me', text: 'Hi' })
    await jmap.waitForEmail({ subject: 'Hover me' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const row = mailbox.emailRow('Hover me')
    const viewport = page.viewportSize()
    test.skip(
      viewport === null || viewport.width < 1000,
      'compact rows have no hover actions'
    )
    // The opacity is on the group of actions, and on the box around the date
    const remove = row.locator('[data-row-actions]')
    const date = row.getByTestId('email-list-item-date').locator('..')

    await page.mouse.move(0, 0)
    await expect(remove).toHaveCSS('opacity', '0')
    await expect(date).toHaveCSS('opacity', '1')
    await row.hover()
    await expect(remove).toHaveCSS('opacity', '1')
    await expect(date).toHaveCSS('opacity', '0')
    await expect(row.getByTestId('email-list-item-toggle-seen')).toBeVisible()
    await expect(row.getByTestId('email-list-item-more')).toBeVisible()

    await page.mouse.move(0, 0)
    await expect(remove).toHaveCSS('opacity', '0')
    await row.getByTestId('email-list-item-toggle-seen').focus()
    await expect(remove).toHaveCSS('opacity', '1')
  })

  test('LST-03 a row says, as tmail-flutter, that its email was answered', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'Answer me', text: 'Hi' })
    const email = await jmap.waitForEmail({ subject: 'Answer me' })
    await jmap.setKeywords(email.id, { $answered: true })
    const mailbox = await new LoginPage(page).loginAs(user)
    const row = mailbox.emailRow('Answer me')
    const viewport = page.viewportSize()
    test.skip(
      viewport === null || viewport.width < 1000,
      'compact rows show no answered state'
    )

    await expect(row.getByTestId('email-list-item-answered')).toHaveAccessibleName(
      'Replied message'
    )
  })

  test('LST-04 the hover actions open the email in a tab of its own, and move it', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'Elsewhere', text: 'Hi' })
    const email = await jmap.waitForEmail({ subject: 'Elsewhere' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const row = mailbox.emailRow('Elsewhere')
    const viewport = page.viewportSize()
    test.skip(
      viewport === null || viewport.width < 1000,
      'compact rows have no hover actions'
    )

    await row.hover()
    const popup = page.waitForEvent('popup')
    await row.getByTestId('email-list-item-open-in-new-tab').click()
    const tab = await popup
    await expect(tab).toHaveURL(new RegExp(`/email/${email.id}$`))
    // The credentials of a basic login live in the memory of the first tab,
    // which hands them over to the new one: it lands on the email (shown with
    // its conversation, the default), no sign-in
    await new ConversationPage(tab).expectLoaded('Elsewhere')
    await expect(tab.getByRole('form', { name: 'Sign In' })).toHaveCount(0)
    await tab.close()

    await row.hover()
    await row.getByTestId('email-list-item-move').click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('LST-05 the toolbar and the rows have the measures of tmail-flutter', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'Measured', text: 'Hi' })
    await jmap.waitForEmail({ subject: 'Measured' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const viewport = page.viewportSize()
    test.skip(
      viewport === null || viewport.width < 1000,
      'compact rows have other measures'
    )
    const row = mailbox.emailRow('Measured')
    const box = async (locator: ReturnType<typeof row.locator>) => {
      const found = await locator.boundingBox()
      expect(found).not.toBeNull()
      return found ?? { x: 0, y: 0, width: 0, height: 0 }
    }

    const toolbar = page.getByTestId('list-toolbar')
    const rowBox = await box(row)
    const toolbarBox = await box(toolbar)
    const refresh = await box(page.getByTestId('list-refresh-button'))
    const selectAll = await box(page.getByTestId('list-select-all-button'))
    // As tmail-flutter: the toolbar and the rows span the card, 12 px above
    // the buttons (a 32 px refresh, 34 px text buttons), 16 px apart
    expect(rowBox.x).toBe(toolbarBox.x)
    expect(refresh.width).toBe(32)
    expect(refresh.height).toBe(32)
    expect(selectAll.height).toBe(34)
    expect(selectAll.y - toolbarBox.y).toBe(12)
    expect(selectAll.x - (refresh.x + refresh.width)).toBe(16)
    // As tmail-flutter: 48 px rows, a 40 px checkbox, a bare 20 px star
    expect(rowBox.height).toBeGreaterThanOrEqual(47.5)
    expect(rowBox.height).toBeLessThanOrEqual(48.5)
    const checkbox = await box(row.getByTestId('email-list-item-checkbox'))
    expect([checkbox.width, checkbox.height]).toEqual([40, 40])
    const star = await box(row.getByTestId('email-list-item-star'))
    expect([star.width, star.height]).toEqual([20, 20])
    // The 32 px gradient avatar of the sender
    const avatar = await box(row.getByTestId('email-list-item-avatar'))
    expect([avatar.width, avatar.height]).toEqual([32, 32])
  })
})

test.describe('LST labels in the list rows', () => {
  test(
    'LST-06 a row shows one label chip then "+N" naming the others, at the end of the preview on a phone and a tablet, before the subject without growing the row on a desktop',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      const design = await jmap.createLabel('Design', '#2196F3')
      const urgent = await jmap.createLabel('Urgent', '#F44336')
      const personal = await jmap.createLabel('Personal', '#4CAF50')
      for (const subject of ['Plain row', 'Three labels row']) {
        await jmap.sendEmail({
          to: user.email,
          subject,
          text: 'A body that gives the row a preview of some length'
        })
      }
      const email = await jmap.waitForEmail({ subject: 'Three labels row' })
      await jmap.waitForEmail({ subject: 'Plain row' })
      await jmap.setKeywords(email.id, {
        [design.keyword]: true,
        [urgent.keyword]: true,
        [personal.keyword]: true
      })
      const mailbox = await new LoginPage(page).loginAs(user)
      const row = mailbox.emailRow('Three labels row')

      await expect(row.getByTestId('label-chip')).toHaveCount(1)
      await expect(row.getByTestId('label-chip')).toHaveText('Design')
      await expect(row.getByTestId('label-chip-more')).toHaveText('+2')
      // The hidden labels are named for assistive technologies
      await expect(
        row.getByRole('list', { name: 'Labels of the email' })
      ).toContainText('2 more labels: Personal, Urgent')
      const rowBox = await row.boundingBox()
      const chipBox = await row.getByTestId('label-chip').boundingBox()
      const subjectBox = await row
        .getByTestId('email-list-item-subject')
        .boundingBox()
      const previewBox = await row
        .getByTestId('email-list-item-preview')
        .boundingBox()
      const viewport = page.viewportSize()
      if (viewport !== null && viewport.width < 1000) {
        // Phones and tablets: the chips end the preview line, inside the row
        expect(chipBox?.y ?? 0).toBeGreaterThan(subjectBox?.y ?? 0)
        expect(chipBox?.y ?? 0).toBeGreaterThanOrEqual(previewBox?.y ?? 0)
        expect((chipBox?.x ?? 0) + (chipBox?.width ?? 0)).toBeLessThanOrEqual(
          (rowBox?.x ?? 0) + (rowBox?.width ?? 0)
        )
        expect((chipBox?.y ?? 0) + (chipBox?.height ?? 0)).toBeLessThanOrEqual(
          (rowBox?.y ?? 0) + (rowBox?.height ?? 0)
        )
      } else {
        // A desktop: the row is as high as one without labels
        const plainBox = await mailbox.emailRow('Plain row').boundingBox()
        expect(
          Math.abs((rowBox?.height ?? 0) - (plainBox?.height ?? 99))
        ).toBeLessThan(1)
        expect(chipBox?.x).toBeLessThan(subjectBox?.x ?? 0)
      }
      await expectNoA11yViolations(page)
    }
  )

  test('LST-07 the row of a conversation shows the labels of the email that stands for it (the last one), as tmail-flutter', async ({
    page,
    user,
    jmap
  }) => {
    const older = await jmap.createLabel('Older', '#2196F3')
    const latest = await jmap.createLabel('Latest', '#F44336')
    const original = await jmap.importEml(
      'reply_email/reply-thread.eml',
      'inbox',
      {
        keywords: { $seen: true, [older.keyword]: true },
        receivedAt: '2024-12-17T16:31:00Z'
      }
    )
    const replyId = await addReplyInInbox(jmap, original, {
      from: 'emma@example.com',
      to: user.email,
      text: 'the latest reply'
    })
    await jmap.setKeywords(replyId, { $seen: true, [latest.keyword]: true })
    const mailbox = await new LoginPage(page).loginAs(user)
    const row = mailbox.emailRow('Re: Reply thread')

    await expect(row.getByTestId('email-list-item-thread-count')).toBeVisible()
    await expect(row.getByTestId('label-chip')).toHaveCount(1)
    await expect(row.getByTestId('label-chip')).toHaveText('Latest')
    await expect(row).not.toContainText('Older')
  })

  test('LST-08 the rows of a label view show their labels on the same line as the inbox, and a long label name is cut', async ({
    page,
    user,
    jmap
  }) => {
    const long = await jmap.createLabel(
      'An extremely long label name that must be cut',
      '#FF9800'
    )
    await jmap.sendEmail({
      to: user.email,
      subject: 'Long label row',
      text: 'A body that gives the row a preview'
    })
    const email = await jmap.waitForEmail({ subject: 'Long label row' })
    await jmap.setKeywords(email.id, { [long.keyword]: true })
    const mailbox = await new LoginPage(page).loginAs(user)
    const viewport = page.viewportSize()
    test.skip(
      viewport === null || viewport.width < 1000,
      'the label view is reached from the sidebar of a desktop'
    )
    const inboxHeight = (await mailbox.emailRow('Long label row').boundingBox())
      ?.height

    await page.getByRole('link', { name: long.displayName }).click()
    const row = mailbox.emailRow('Long label row').first()
    await expect(row).toBeVisible()

    const chip = row.getByTestId('label-chip')
    await expect(chip).toHaveCount(1)
    // Cut with an ellipsis, the whole name in its title
    await expect(chip).toContainText('…')
    await expect(chip).toHaveAttribute('title', long.displayName)
    expect(
      Math.abs(((await row.boundingBox())?.height ?? 0) - (inboxHeight ?? 99))
    ).toBeLessThan(1)
  })
})

test.describe('LST list rows at every width', () => {
  test('LST-09 from 600 to 1440 px the date never overlaps the subject, which keeps room to read', async ({
    page,
    user,
    jmap
  }) => {
    const label = await jmap.createLabel('Design', '#2196F3')
    await jmap.sendEmail({
      to: user.email,
      subject: 'Width sweep subject',
      text: 'A body that gives the row a preview of some length to fill the row'
    })
    const email = await jmap.waitForEmail({
      subject: 'Width sweep subject'
    })
    await jmap.setKeywords(email.id, { [label.keyword]: true })
    const mailbox = await new LoginPage(page).loginAs(user)
    const row = mailbox.emailRow('Width sweep subject')
    await expect(row).toBeVisible()

    for (const width of [600, 720, 820, 1024, 1180, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      // The table measures itself again after a resize: look until it settles
      await expect(async () => {
        await expect(row.getByTestId('email-list-item-subject')).toBeVisible()
        await expect(row.getByTestId('email-list-item-date')).toBeVisible()
        const subject = await row
          .getByTestId('email-list-item-subject')
          .boundingBox()
        const date = await row.getByTestId('email-list-item-date').boundingBox()
        expect(subject, `subject at ${String(width)}`).not.toBeNull()
        expect(date, `date at ${String(width)}`).not.toBeNull()
        const overlaps =
          (subject?.x ?? 0) < (date?.x ?? 0) + (date?.width ?? 0) &&
          (date?.x ?? 0) < (subject?.x ?? 0) + (subject?.width ?? 0) &&
          (subject?.y ?? 0) < (date?.y ?? 0) + (date?.height ?? 0) &&
          (date?.y ?? 0) < (subject?.y ?? 0) + (subject?.height ?? 0)
        expect(overlaps, `date over the subject at ${String(width)}`).toBe(
          false
        )
        // Its cell keeps room to read (the subject itself is as wide as
        // its text)
        const cell = await row
          .getByTestId('email-list-item-subject')
          .locator('xpath=ancestor::td[1]')
          .boundingBox()
        expect(
          cell?.width ?? 0,
          `subject at ${String(width)}`
        ).toBeGreaterThan(150)
      }).toPass()
    }
  })
})
