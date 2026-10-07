import { LoginPage, SearchPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'
import type { E2ETeamMailbox } from '../support/users'

/** The folders of a team mailbox by name (INBOX, Drafts, Sent, Trash…), as the member sees them */
async function teamFolders(
  jmap: JmapClient,
  team: E2ETeamMailbox
): Promise<Record<string, string>> {
  const namespace = `TeamMailbox[${team.email}]`
  return Object.fromEntries(
    (await jmap.getMailboxes())
      .filter(mailbox => mailbox.namespace === namespace)
      .map(mailbox => [mailbox.name, mailbox.id])
  )
}

function folderId(folders: Record<string, string>, name: string): string {
  const id = folders[name]
  if (id === undefined) throw new Error(`No team folder ${name}`)
  return id
}

test.describe('TMB team mailboxes', () => {
  test('TMB-01 the team mailbox lists its address and its folders in the order of tmail-flutter', async ({
    page,
    user,
    users
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.toggleFolder({ name: team.name })

    const section = mailbox.teamMailboxesSection
    await expect(section.getByTestId('mailbox-item-address')).toHaveText(
      team.email
    )
    await expect(section.getByTestId('mailbox-item-name')).toHaveText([
      team.name,
      'Inbox',
      'Drafts',
      'Outbox',
      'Sent',
      'Trash',
      'Templates'
    ])
    await expectNoA11yViolations(page)
  })

  test('TMB-02 deleting an email of a team mailbox moves it to the Trash of the team mailbox', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const folders = await teamFolders(jmap, team)
    const email = await jmap.createEmailIn(folderId(folders, 'INBOX'), {
      subject: 'Team news'
    })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.toggleFolder({ name: team.name })
    await mailbox.openFolder({ id: folderId(folders, 'INBOX') })
    const menu = await mailbox.openEmailMenu('Team news')
    // A team mailbox has neither Archive nor Spam
    await expect(menu.getByTestId('email-action-archive')).toBeHidden()
    await expect(menu.getByTestId('email-action-mark-as-spam')).toBeHidden()
    await menu.getByTestId('email-action-move-to-trash').click()

    await expect(mailbox.toast).toContainText('Moved to Trash')
    await expect
      .poll(async () => (await jmap.getEmail(email.id)).mailboxIds)
      .toEqual({ [folderId(folders, 'Trash')]: true })
  })

  test('TMB-03 deleting a team email found by a search moves it to the Trash of its team mailbox', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const folders = await teamFolders(jmap, team)
    const email = await jmap.createEmailIn(folderId(folders, 'INBOX'), {
      subject: 'Quokka'
    })

    const mailbox = await new LoginPage(page).loginAs(user)
    const search = new SearchPage(page)
    await search.search('Quokka')
    await search.expectResults()
    const menu = await mailbox.openEmailMenu('Quokka')
    await expect(menu.getByTestId('email-action-archive')).toBeHidden()
    await menu.getByTestId('email-action-move-to-trash').click()

    await expect(mailbox.toast).toContainText('Moved to Trash')
    await expect
      .poll(async () => (await jmap.getEmail(email.id)).mailboxIds)
      .toEqual({ [folderId(folders, 'Trash')]: true })
  })

  test('TMB-04 a search leaves the emails of the Trash of a team mailbox out', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const folders = await teamFolders(jmap, team)
    await jmap.createEmailIn(folderId(folders, 'Trash'), { subject: 'Wombat' })
    await jmap.createEmailIn(folderId(folders, 'INBOX'), { subject: 'Numbat' })

    await new LoginPage(page).loginAs(user)
    const search = new SearchPage(page)
    await search.search('Numbat')
    await search.expectResults()
    await expect.poll(() => search.resultSubjects()).toEqual(['Numbat'])
    await search.search('Wombat')
    await expect(search.emptyView).toBeVisible()
  })

  test('TMB-05 emptying the Trash of a team mailbox deletes its emails and subfolders', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const folders = await teamFolders(jmap, team)
    const trashId = folderId(folders, 'Trash')
    await jmap.createEmailIn(trashId, { subject: 'old one' })
    await jmap.createEmailIn(trashId, { subject: 'old two' })
    const old = await jmap.createMailbox({ name: 'Old stuff', parentId: trashId })

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.toggleFolder({ name: team.name })
    await mailbox.openFolder({ id: trashId })
    await expect(mailbox.emptyTrashBanner).toBeVisible()
    await mailbox.emptyTrashBanner.getByRole('button').click()
    const dialog = mailbox.confirmDialog
    await expect(dialog).toContainText('Empty Trash')
    await dialog.getByRole('button', { name: 'Delete' }).click()

    await expect(mailbox.toast).toContainText('Trash subfolders deleted')
    await expect(mailbox.emptyListView).toBeVisible()
    await expect
      .poll(async () => (await jmap.getMailboxes()).some(m => m.id === old.id))
      .toBe(false)
    await expect
      .poll(async () => (await jmap.queryEmails({ inMailbox: trashId })).length)
      .toBe(0)
  })

  test('TMB-06 a message sent as a team mailbox keeps its copy in the Sent of the team mailbox', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    const team = await users.createTeamMailbox({ members: [user] })
    const folders = await teamFolders(jmap, team)

    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.chooseIdentity(team.email)
    await composer.fill({ to: [bob.email], subject: 'From the team', body: 'Hi' })
    await composer.send()

    await expect(mailbox.toast).toContainText('Message has been sent successfully')
    await jmap.waitForEmail({
      subject: 'From the team',
      mailboxId: folderId(folders, 'Sent'),
      withoutSearch: true
    })
    const personalSent = await jmap.findMailboxByRole('sent')
    expect(
      (await jmap.queryEmails({ inMailbox: personalSent.id })).map(
        email => email.subject
      )
    ).not.toContain('From the team')
  })

  test('TMB-07 a draft written as a team mailbox is saved in the Drafts of the team mailbox', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const folders = await teamFolders(jmap, team)

    await page.clock.install()
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.chooseIdentity(team.email)
    await composer.fill({ to: ['bob@example.com'], subject: 'Team draft' })
    await composer.idle()
    await expect(composer.saveStatus).toContainText('Draft saved', {
      timeout: 15_000
    })

    await jmap.waitForEmail({
      subject: 'Team draft',
      mailboxId: folderId(folders, 'Drafts'),
      withoutSearch: true
    })
    const personalDrafts = await jmap.findMailboxByRole('drafts')
    expect(await jmap.queryEmails({ inMailbox: personalDrafts.id })).toEqual([])
  })

  test('TMB-08 a member with read rights only is offered no action that changes the emails', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const manager = await users.create({ prefix: 'manager' })
    const team = await users.createTeamMailbox({
      members: [user],
      managers: [manager]
    })
    const folders = await teamFolders(jmap, team)
    const inboxId = folderId(folders, 'INBOX')
    await jmap.createEmailIn(inboxId, {
      subject: 'Read only news',
      keywords: {}
    })
    // The manager takes the rights of the member in the INBOX away, but reading
    await jmapFor(manager).shareMailbox(inboxId, user.email, ['l', 'r'])

    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.toggleFolder({ name: team.name })
    await mailbox.openFolder({ id: inboxId })
    const rowMenu = await mailbox.openEmailMenu('Read only news')
    await expect(rowMenu.getByTestId('email-action-move-to-trash')).toBeHidden()
    await expect(rowMenu.getByTestId('email-action-mark-as-read')).toBeHidden()
    await expect(rowMenu.getByTestId('email-action-star')).toBeHidden()
    await expect(rowMenu.getByTestId('email-action-move')).toBeHidden()
    await mailbox.page.keyboard.press('Escape')

    const folderMenu = await mailbox.openFolderMenu({ id: inboxId })
    await expect(folderMenu.getByTestId('mailbox-action-new-subfolder')).toBeHidden()
    await expect(folderMenu.getByTestId('mailbox-action-mark-as-read')).toBeHidden()
  })

  test('TMB-09 the move picker lists a folder emails cannot be added to as unavailable', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const manager = await users.create({ prefix: 'manager' })
    const team = await users.createTeamMailbox({
      members: [user],
      managers: [manager]
    })
    const folders = await teamFolders(jmap, team)
    await jmapFor(manager).shareMailbox(folderId(folders, 'INBOX'), user.email, [
      'l',
      'r',
      's',
      'w'
    ])
    await jmap.sendEmail({ to: user.email, subject: 'To move', text: 'x' })
    await jmap.waitForEmail({ subject: 'To move' })

    const mailbox = await new LoginPage(page).loginAs(user)
    const menu = await mailbox.openEmailMenu('To move')
    await menu.getByTestId('email-action-move').click()
    await expect(mailbox.mailboxPicker).toBeVisible()
    await mailbox.mailboxPicker.getByTestId('mailbox-picker-search-input').fill('INBOX')

    await expect(
      // By its path: the Inbox of the user is named Inbox too
      mailbox.mailboxPicker.getByRole('option', { name: `${team.name}/Inbox` })
    ).toHaveAttribute('aria-disabled', 'true')
  })
})
