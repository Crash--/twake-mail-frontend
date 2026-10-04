import { LoginPage, type MailboxPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test, type E2EUser } from '../support/fixtures'
import type { JmapClient, MailboxRole } from '../support/jmap'

/** Sends emails to self (each lands in the Inbox, its copy in Sent) and waits for them */
async function seed(
  jmap: JmapClient,
  user: E2EUser,
  subjects: string[]
): Promise<string[]> {
  const ids: string[] = []
  for (const subject of subjects) {
    await jmap.sendEmail({ to: user.email, subject, text: `${subject} body` })
    ids.push((await jmap.waitForEmail({ subject })).id)
  }
  return ids
}

/** Sends one email to self and returns its id in the Inbox */
async function seedOne(
  jmap: JmapClient,
  user: E2EUser,
  subject: string
): Promise<string> {
  const [id] = await seed(jmap, user, [subject])
  if (id === undefined) throw new Error(`No email "${subject}" seeded`)
  return id
}

/** The roles of the mailboxes an email is in, on the server */
async function rolesOf(jmap: JmapClient, emailId: string): Promise<string[]> {
  const email = await jmap.getEmail(emailId)
  const mailboxes = await jmap.getMailboxes()
  return mailboxes
    .filter(mailbox => email.mailboxIds[mailbox.id] === true)
    .map(mailbox => mailbox.role ?? mailbox.name)
}

async function expectListedIn(
  mailbox: MailboxPage,
  role: MailboxRole,
  subject: string
): Promise<void> {
  await mailbox.openFolder({ role })
  await expect(mailbox.emailRow(subject)).toBeVisible()
}

test.describe('EML acting on an open email', () => {
  // The reading view of a single email: the "Thread" setting off
  test.use({ emailsOneByOne: true })

  test('EML-06 "Archive message" from the more menu moves the email to Archive', { tag: '@mobile' }, async ({
    page,
    user,
    jmap
  }) => {
    const id = await seedOne(jmap, user, 'to archive')

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('to archive')
    await email.openMoreMenu()
    await expectNoA11yViolations(page)
    await page.keyboard.press('Escape')
    await email.runAction('archive')

    await expect(email.root).toBeHidden()
    await expect(mailbox.toast).toContainText('Moved to Archive')
    await expect.poll(() => rolesOf(jmap, id)).toEqual(['archive'])
    await expectListedIn(mailbox, 'archive', 'to archive')
  })

  test('EML-07 "Move to trash" closes the email, which is listed in Trash', { tag: '@mobile' }, async ({
    page,
    user,
    jmap
  }) => {
    const id = await seedOne(jmap, user, 'to trash')

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('to trash')
    await email.runAction('move-to-trash')

    await expect(email.root).toBeHidden()
    await expect(mailbox.toast).toContainText('Moved to Trash')
    await expect.poll(() => rolesOf(jmap, id)).toEqual(['trash'])
    await expectListedIn(mailbox, 'trash', 'to trash')
  })

  test('EML-09 "Mark as spam" closes the email, which is listed in Spam', async ({
    page,
    user,
    jmap
  }) => {
    const id = await seedOne(jmap, user, 'to spam')

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('to spam')
    await email.runAction('mark-as-spam')

    await expect(email.root).toBeHidden()
    await expect.poll(() => rolesOf(jmap, id)).toEqual(['junk'])
    await expectListedIn(mailbox, 'junk', 'to spam')
  })

  test('EML-10 the more menu offers "Star", then "Unstar", then "Star" again', async ({
    page,
    user,
    jmap
  }) => {
    const id = await seedOne(jmap, user, 'to star')

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('to star')
    await email.runAction('star')
    await expect.poll(async () => (await jmap.getEmail(id)).keywords).toMatchObject({
      $flagged: true
    })

    let menu = await email.openMoreMenu()
    await expect(menu.getByTestId('email-action-star')).toBeHidden()
    await menu.getByTestId('email-action-unstar').click()
    await expect
      .poll(async () => '$flagged' in (await jmap.getEmail(id)).keywords)
      .toBe(false)

    menu = await email.openMoreMenu()
    await expect(menu.getByTestId('email-action-star')).toBeVisible()
  })

  test('EML-11 "Mark as unread" closes the email, whose row is unread again', async ({
    page,
    user,
    jmap
  }) => {
    const id = await seedOne(jmap, user, 'to leave unread')

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('to leave unread')
    await expect.poll(async () => '$seen' in (await jmap.getEmail(id)).keywords).toBe(true)
    await email.runAction('mark-as-unread')

    await expect(email.root).toBeHidden()
    await expect(mailbox.emailRow('to leave unread')).toHaveAttribute('data-unread', 'true')
    await expect
      .poll(async () => '$seen' in (await jmap.getEmail(id)).keywords)
      .toBe(false)
  })

  test('EML-12 "Move message" to Templates in the picker takes it out of the Inbox', async ({
    page,
    user,
    jmap
  }) => {
    const id = await seedOne(jmap, user, 'to move')
    const templates = await jmap.createMailbox({ name: 'Templates' })

    const mailbox = await new LoginPage(page).loginAs(user)
    const email = await mailbox.openEmail('to move')
    await email.runAction('move')
    await expect(mailbox.mailboxPicker).toBeVisible()
    await expectNoA11yViolations(page)
    await mailbox.pickFolder('Templates')

    await expect(email.root).toBeHidden()
    await expect(mailbox.emailRow('to move')).toBeHidden()
    await expect
      .poll(async () => Object.keys((await jmap.getEmail(id)).mailboxIds))
      .toEqual([templates.id])
    await mailbox.openFolder({ name: 'Templates' })
    await expect(mailbox.emailRow('to move')).toBeVisible()
  })

  test('EML-30 "Delete permanently" from the Trash asks, then destroys the email', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'gone for good', text: 'x', saveTo: 'trash' })
    const trashed = await jmap.waitForEmail({ subject: 'gone for good', mailboxRole: 'trash' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'trash' })
    const email = await mailbox.openEmail('gone for good')
    await email.runAction('delete-permanently')
    await expect(mailbox.confirmDialog).toBeVisible()
    await expectNoA11yViolations(page)
    await mailbox.confirmDialog.getByTestId('confirm-dialog-confirm-button').click()

    await expect(email.root).toBeHidden()
    await expect(mailbox.toast).toContainText('Message has been deleted forever')
    await expect
      .poll(async () => (await jmap.getEmails([trashed.id])).length)
      .toBe(0)
  })

  test('EML-31 "Remove from spam" puts the email back in the Inbox', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'not junk', text: 'x', saveTo: 'junk' })
    const spam = await jmap.waitForEmail({ subject: 'not junk', mailboxRole: 'junk' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'junk' })
    const email = await mailbox.openEmail('not junk')
    await email.runAction('not-spam')

    await expect(email.root).toBeHidden()
    await expect(mailbox.toast).toContainText('Marked as not spam')
    await expect.poll(() => rolesOf(jmap, spam.id)).toEqual(['inbox'])
  })
})

test.describe('MBX acting on a selection', () => {
  test('MBX-19 a selected email moves to Templates, another to the Trash', async ({
    page,
    user,
    jmap
  }) => {
    const first = await seedOne(jmap, user, 'first selected')
    const second = await seedOne(jmap, user, 'second selected')
    const templates = await jmap.createMailbox({ name: 'Templates' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.selectEmail('first selected')
    await expectNoA11yViolations(page)
    await mailbox.runSelectionAction('move')
    await mailbox.pickFolder('Templates')
    await expect(mailbox.emailRow('first selected')).toBeHidden()
    await expect(mailbox.selectionToolbar).toBeHidden()

    await mailbox.selectEmail('second selected')
    await mailbox.runSelectionAction('move-to-trash')
    await expect(mailbox.emailRow('second selected')).toBeHidden()

    await expect
      .poll(async () => Object.keys((await jmap.getEmail(first)).mailboxIds))
      .toEqual([templates.id])
    await expect.poll(() => rolesOf(jmap, second)).toEqual(['trash'])
    await mailbox.openFolder({ name: 'Templates' })
    await expect(mailbox.emailRow('first selected')).toBeVisible()
  })

  test('MBX-20 "Mark as read" on a single selected unread email', { tag: '@mobile' }, async ({
    page,
    user,
    jmap
  }) => {
    const id = await seedOne(jmap, user, 'unread one')

    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emailRow('unread one')).toHaveAttribute('data-unread', 'true')
    await mailbox.selectEmail('unread one')
    await mailbox.runSelectionAction('mark-as-read')

    await expect(mailbox.emailRow('unread one')).not.toHaveAttribute('data-unread')
    await expect
      .poll(async () => '$seen' in (await jmap.getEmail(id)).keywords)
      .toBe(true)
  })

  test('MBX-21 "Star" on a single selected email', async ({ page, user, jmap }) => {
    const id = await seedOne(jmap, user, 'star me')

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.selectEmail('star me')
    await mailbox.runSelectionAction('star')

    await expect(mailbox.emailRowStar('star me')).toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(async () => '$flagged' in (await jmap.getEmail(id)).keywords)
      .toBe(true)
  })

  test('MBX-22 "Mark as spam" on a single selected email moves it to Spam', async ({
    page,
    user,
    jmap
  }) => {
    const id = await seedOne(jmap, user, 'spam me')

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.selectEmail('spam me')
    await mailbox.runSelectionAction('mark-as-spam')

    await expect(mailbox.emailRow('spam me')).toBeHidden()
    await expect.poll(() => rolesOf(jmap, id)).toEqual(['junk'])
    await expectListedIn(mailbox, 'junk', 'spam me')
  })

  test('MBX-26 a range of rows (Shift+click) is marked read in one action, the others untouched', async ({
    page,
    user,
    jmap
  }) => {
    // Sent to oneself, each email also has a copy in Sent: the account has messages in two
    // mailboxes, out of the case where the memory backend updates every message of the account
    // for a batch of more than 3 ids (tmail-backend#2684)
    const ids = await seed(jmap, user, ['batch 1', 'batch 2', 'batch 3', 'batch 4', 'batch 5'])

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.selectEmail('batch 5')
    await mailbox.selectEmail('batch 2', { range: true })
    await expect(mailbox.selectionToolbar).toContainText('4 selected')
    await mailbox.runSelectionAction('mark-as-read')

    await expect(mailbox.toast).toContainText('You’ve marked messages as "Read"')
    await expect(mailbox.selectionToolbar).toBeHidden()
    const seenOf = async (): Promise<boolean[]> =>
      Promise.all(ids.map(async id => '$seen' in (await jmap.getEmail(id)).keywords))
    await expect.poll(seenOf).toEqual([false, true, true, true, true])
    await expect(mailbox.emailRow('batch 1')).toHaveAttribute('data-unread', 'true')
  })

  test('MBX-27 the menu of a row opens on a right click and on Shift+F10', async ({
    page,
    user,
    jmap
  }) => {
    const archived = await seedOne(jmap, user, 'by right click')
    const trashed = await seedOne(jmap, user, 'by keyboard')

    const mailbox = await new LoginPage(page).loginAs(user)
    const menu = await mailbox.openEmailMenu('by right click', { rightClick: true })
    await expectNoA11yViolations(page)
    await menu.getByTestId('email-action-archive').click()
    await expect(mailbox.emailRow('by right click')).toBeHidden()

    await mailbox.emailRowLink('by keyboard').focus()
    await page.keyboard.press('Shift+F10')
    const keyboardMenu = page.getByTestId('email-context-menu').getByRole('menu')
    await expect(keyboardMenu).toBeVisible()
    await expect(keyboardMenu.getByRole('menuitem').first()).toBeFocused()
    await keyboardMenu.getByTestId('email-action-move-to-trash').press('Enter')

    await expect(mailbox.emailRow('by keyboard')).toBeHidden()
    await expect.poll(() => rolesOf(jmap, archived)).toEqual(['archive'])
    await expect.poll(() => rolesOf(jmap, trashed)).toEqual(['trash'])
  })

  test('MBX-28 rows dragged onto a folder of the tree move there', async ({
    page,
    user,
    jmap
  }) => {
    const ids = await seed(jmap, user, ['dragged 1', 'dragged 2'])
    const work = await jmap.createMailbox({ name: 'Work' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.selectEmail('dragged 1')
    await mailbox.selectEmail('dragged 2')
    await mailbox.emailRow('dragged 2').dragTo(mailbox.folder({ name: 'Work' }))

    await expect(mailbox.emailRow('dragged 1')).toBeHidden()
    await expect(mailbox.emailRow('dragged 2')).toBeHidden()
    for (const id of ids) {
      await expect
        .poll(async () => Object.keys((await jmap.getEmail(id)).mailboxIds))
        .toEqual([work.id])
    }
  })
})

test.describe('MBX emptying the Trash and Spam', () => {
  test('MBX-08 "Empty trash now" asks, then empties the Trash', async ({ page, user, jmap }) => {
    await jmap.sendEmail({ to: user.email, subject: 'in the bin', text: 'x', saveTo: 'trash' })
    await jmap.waitForEmail({ subject: 'in the bin', mailboxRole: 'trash' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'trash' })
    await expect(mailbox.emailRow('in the bin')).toBeVisible()
    await expect(mailbox.emptyTrashBanner).toBeVisible()
    await expectNoA11yViolations(page)
    await mailbox.emptyTrashBanner.getByRole('button', { name: 'Empty trash now' }).click()
    await expect(mailbox.confirmDialog).toBeVisible()
    await mailbox.confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(mailbox.emptyListView).toBeVisible()
    const trash = await jmap.findMailboxByRole('trash')
    await expect.poll(async () => (await jmap.queryEmails({ inMailbox: trash.id })).length).toBe(0)
  })

  test('MBX-09 emptying the Trash from its banner also removes its subfolders', async ({
    page,
    user,
    jmap
  }) => {
    const trash = await jmap.findMailboxByRole('trash')
    await jmap.createMailbox({ name: 'Old stuff', parentId: trash.id })
    await jmap.sendEmail({ to: user.email, subject: 'trashed', text: 'x', saveTo: 'trash' })
    await jmap.waitForEmail({ subject: 'trashed', mailboxRole: 'trash' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'trash' })
    await mailbox.emptyTrashBanner.getByRole('button', { name: 'Empty trash now' }).click()
    await mailbox.confirmDialog.getByRole('button', { name: 'Delete' }).click()

    await expect(mailbox.emptyListView).toBeVisible()
    await expect(mailbox.emptyTrashBanner).toBeHidden()
    await mailbox.showFolders()
    await expect(mailbox.folder({ name: 'Old stuff' })).toBeHidden()
    await expect
      .poll(async () => (await jmap.getMailboxes()).some(item => item.name === 'Old stuff'))
      .toBe(false)
  })

  test('MBX-13 (spam banner) "Delete all spam emails now" empties Spam and hides the banner', async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'junk mail', text: 'x', saveTo: 'junk' })
    await jmap.waitForEmail({ subject: 'junk mail', mailboxRole: 'junk' })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.openFolder({ role: 'junk' })
    await mailbox.emptyTrashBanner
      .getByRole('button', { name: 'Delete all spam emails now' })
      .click()
    await mailbox.confirmDialog.getByRole('button', { name: 'Delete all' }).click()

    await expect(mailbox.emptyListView).toBeVisible()
    await expect(mailbox.emptyTrashBanner).toBeHidden()
    await expect(mailbox.toast).toContainText('All messages have been deleted forever')
  })
})
