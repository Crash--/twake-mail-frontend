import type { Locator, Page } from '@playwright/test'

import { LoginPage, type MailboxPage, SettingsPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { openAccountMenuIfAny } from '../support/accountMenu'
import { env } from '../support/env'
import { expect, test } from '../support/fixtures'
import type { E2EUser } from '../support/users'

/** The "Viewing …" pill of the mailbox switcher (tmail-flutter#4977) */
function switcher(page: Page): Locator {
  return page.getByTestId('mailbox-switcher-button')
}

/** Picks a mailbox in the switcher, by the address under its name */
async function switchTo(page: Page, address: string): Promise<void> {
  await switcher(page).click()
  const menu = page.getByRole('menu')
  await menu
    .getByTestId('mailbox-switcher-item')
    .filter({ hasText: address })
    .click()
  await expect(menu).toBeHidden()
}

async function openDelegation(mailbox: MailboxPage): Promise<SettingsPage> {
  const settings = await mailbox.openSettings()
  return settings.open('delegation')
}

function delegateItems(page: Page): Locator {
  return page.getByTestId('delegation-delegate-item')
}

test.describe('DLG delegation', () => {
  test('DLG-01 the owner gives access to a person of the domain picked among the contacts', async ({
    page,
    user,
    users,
    webadmin,
    jmapFor
  }) => {
    const assistant = await users.create({ prefix: 'assistant' })
    await webadmin.createDomainContact(env.domain, {
      emailAddress: assistant.email,
      firstname: 'Ada',
      surname: 'Assistant'
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const settings = await openDelegation(mailbox)

    await expect(page.getByTestId('delegation-delegates-empty')).toContainText(
      'No one has access yet'
    )
    await expectNoA11yViolations(page)
    await page.getByTestId('delegation-add-button').click()
    const dialog = page.getByTestId('delegation-add-dialog')
    await expect(dialog).toBeVisible()
    const add = dialog.getByTestId('delegation-add-confirm-button')
    await expect(add).toBeDisabled()

    await dialog.getByTestId('delegation-input').fill('Ada')
    const ada = page
      .getByTestId('delegation-suggestions')
      .getByRole('option', { name: /Ada Assistant/ })
    // Whole: not cut by the content of the dialog
    await expect(ada).toBeInViewport({ ratio: 1 })
    await ada.click()
    await expect(dialog.getByTestId('delegation-recipient-chip')).toHaveCount(1)
    await expectNoA11yViolations(page)
    // One step: Add gives the access, no confirmation
    await add.click()

    await expect(settings.toast).toContainText('Ada Assistant has been added')
    await expect(dialog).toBeHidden()
    await expect(delegateItems(page)).toHaveCount(1)
    await expect(delegateItems(page)).toContainText('Ada Assistant')
    // The delegate is given the mailbox: it is in their session now
    await expect
      .poll(async () => jmapFor(assistant).delegatedAccounts())
      .toEqual([user.email])
  })

  test('DLG-02 only the people of the domain can be given access', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    await openDelegation(mailbox)
    await page.getByTestId('delegation-add-button').click()
    const dialog = page.getByTestId('delegation-add-dialog')

    await dialog.getByTestId('delegation-input').fill('someone@elsewhere.org')
    await expect(dialog.getByTestId('delegation-input-error')).toHaveText(
      `Only people of ${env.domain} can be given access.`
    )
    await expect(
      dialog.getByTestId('delegation-add-confirm-button')
    ).toBeDisabled()

    await dialog.getByTestId('delegation-input').fill(user.email)
    await expect(dialog.getByTestId('delegation-input-error')).toHaveText(
      'You already have access to your own mailbox.'
    )
    await dialog.getByTestId('delegation-add-cancel-button').click()
    await expect(dialog).toBeHidden()
  })

  test('DLG-03 the owner takes their access back from a delegate', async ({
    page,
    user,
    users,
    webadmin,
    jmapFor
  }) => {
    const assistant = await users.create({ prefix: 'assistant' })
    await webadmin.addDelegate(user.email, assistant.email)
    const mailbox = await new LoginPage(page).loginAs(user)
    const settings = await openDelegation(mailbox)

    await expect(delegateItems(page)).toHaveCount(1)
    await delegateItems(page).getByTestId('delegation-remove-button').click()
    const dialog = page.getByTestId('delegation-remove-dialog')
    await expect(dialog).toContainText('Remove delegate access?')
    await expect(dialog.getByTestId('delegation-remove-person')).toContainText(
      assistant.email
    )
    await expectNoA11yViolations(page)
    await dialog.getByTestId('delegation-remove-confirm-button').click()

    await expect(settings.toast).toContainText('has been removed')
    await expect(page.getByTestId('delegation-delegates-empty')).toBeVisible()
    await expect
      .poll(async () => jmapFor(assistant).delegatedAccounts())
      .toEqual([])
  })

  test('DLG-04 a delegate opens the mailbox of the owner, without its settings, then theirs again', async ({
    page,
    user,
    users,
    webadmin,
    jmap,
    jmapFor
  }) => {
    const boss = await users.create({ prefix: 'boss' })
    await webadmin.addDelegate(boss.email, user.email)
    const bossJmap = jmapFor(boss)
    await bossJmap.createEmailIn(
      (await bossJmap.findMailboxByRole('inbox')).id,
      { subject: 'For the boss only' }
    )
    await jmap.createEmailIn((await jmap.findMailboxByRole('inbox')).id, {
      subject: 'Mine'
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emailList).toContainText('Mine')

    await expect(switcher(page)).toHaveText(/Viewing my email/)
    await switchTo(page, boss.email)

    await expect(switcher(page)).toContainText(`Viewing ${boss.email}`)
    await expect(mailbox.emailList).toContainText('For the boss only')
    await expect(mailbox.emailList).not.toContainText('Mine')
    // No "Manage account": the settings of the mailbox are the owner's
    await openAccountMenuIfAny(page)
    await expect(page.getByTestId('logout-button')).toBeVisible()
    await expect(page.getByTestId('settings-button')).toHaveCount(0)
    await page.keyboard.press('Escape')
    // The settings, by their address, lead back to the mail (a Basic
    // sign-in asks the password again after a page load)
    await page.goto('/settings/profiles')
    await new LoginPage(page).loginAfterReload(user)
    await expect(page).not.toHaveURL(/\/settings/)
    await expect(switcher(page)).toContainText(`Viewing ${boss.email}`)
    await expectNoA11yViolations(page)

    // A reload stays on the mailbox of the owner
    await page.reload()
    await new LoginPage(page).loginAfterReload(user)
    await expect(mailbox.emailList).toContainText('For the boss only')

    await page.getByTestId('mailbox-switcher-back-button').click()
    await expect(switcher(page)).toHaveText(/Viewing my email/)
    await expect(mailbox.emailList).toContainText('Mine')
    await expect(mailbox.emailList).not.toContainText('For the boss only')
    await openAccountMenuIfAny(page)
    await expect(page.getByTestId('settings-button')).toBeVisible()
  })

  test('DLG-05 a delegate sends from the mailbox of the owner, as the owner', async ({
    page,
    user,
    users,
    webadmin,
    jmapFor
  }) => {
    const boss = await users.create({ prefix: 'boss' })
    const client = await users.create({ prefix: 'client' })
    await webadmin.addDelegate(boss.email, user.email)
    const mailbox = await new LoginPage(page).loginAs(user)
    await switchTo(page, boss.email)
    await expect(switcher(page)).toContainText(`Viewing ${boss.email}`)

    // The owner's identities only: one, so no From line to pick from
    const composer = await mailbox.compose()
    await composer.fill({
      to: [client.email],
      subject: 'Sent by the assistant'
    })
    await composer.send()
    await expect(mailbox.toast).toContainText(
      'Message has been sent successfully'
    )

    const received = await jmapFor(client).waitForEmail({
      subject: 'Sent by the assistant'
    })
    expect(received.from?.map(address => address.email)).toEqual([boss.email])
    // Filed in the Sent folder of the owner, not of the delegate
    await jmapFor(boss).waitForEmail({
      subject: 'Sent by the assistant',
      mailboxRole: 'sent'
    })
  })

  test('DLG-06 a delegate gives up their access to a mailbox', async ({
    page,
    user,
    users,
    webadmin
  }) => {
    const boss = await users.create({ prefix: 'boss' })
    await webadmin.addDelegate(boss.email, user.email)
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(switcher(page)).toBeVisible()
    const settings = await openDelegation(mailbox)

    await page.getByTestId('delegation-delegated-tab').click()
    const items = page.getByTestId('delegation-delegated-item')
    await expect(items).toHaveCount(1)
    await expect(items).toContainText(boss.email)
    await expectNoA11yViolations(page)
    await items.getByTestId('delegation-remove-button').click()
    const dialog = page.getByTestId('delegation-remove-dialog')
    await expect(dialog).toContainText('Remove your access?')
    await dialog.getByTestId('delegation-remove-confirm-button').click()

    await expect(settings.toast).toContainText(
      `You no longer have access to the mailbox of ${boss.email}`
    )
    await expect(page.getByTestId('delegation-delegated-empty')).toBeVisible()
    await settings.backToMail()
    await expect(mailbox.emailList.or(mailbox.emptyListView)).toBeVisible()
    await expect(switcher(page)).toHaveCount(0)
  })

  test('DLG-07 a team mailbox picked in the switcher bounds the screens to it, and writes from its address', async ({
    page,
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const client: E2EUser = await users.create({ prefix: 'client' })
    const teamInbox = (await jmap.getMailboxes()).find(
      folder =>
        folder.namespace === `TeamMailbox[${team.email}]` &&
        folder.name === 'INBOX'
    )
    if (teamInbox === undefined) throw new Error('No team Inbox')
    await jmap.createEmailIn(teamInbox.id, { subject: 'Team matter' })
    await jmap.createEmailIn((await jmap.findMailboxByRole('inbox')).id, {
      subject: 'Personal matter'
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emailList).toContainText('Personal matter')

    await switchTo(page, team.email)

    await expect(switcher(page)).toContainText(`Viewing ${team.name}`)
    await expect(mailbox.emailList).toContainText('Team matter')
    await expect(mailbox.emailList).not.toContainText('Personal matter')
    // The folders of the team mailbox only: no Starred, no personal folder
    await expect(mailbox.folderTree.getByTestId('mailbox-item-name')).toHaveText([
      'Inbox',
      'Drafts',
      'Outbox',
      'Sent',
      'Trash',
      'Templates'
    ])
    await expect(page.getByTestId('folders-section-toggle')).toHaveCount(0)
    await expectNoA11yViolations(page)

    const composer = await mailbox.compose()
    await composer.showIdentity()
    await expect(composer.identitySelect).toContainText(team.email)
    await composer.fill({ to: [client.email], subject: 'From the team' })
    await composer.send()
    await expect(mailbox.toast).toContainText(
      'Message has been sent successfully'
    )
    const received = await jmapFor(client).waitForEmail({
      subject: 'From the team'
    })
    expect(received.from?.map(address => address.email)).toEqual([team.email])

    await page.getByTestId('mailbox-switcher-back-button').click()
    await expect(mailbox.emailList).toContainText('Personal matter')
  })

  test('DLG-08 the switcher works with the keyboard alone', async ({
    page,
    user,
    users,
    webadmin
  }) => {
    const boss = await users.create({ prefix: 'boss' })
    await webadmin.addDelegate(boss.email, user.email)
    await new LoginPage(page).loginAs(user)

    await switcher(page).focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    // The focus goes to the mailbox shown, ticked
    await expect(
      menu.getByRole('menuitemradio', { name: new RegExp(user.email) })
    ).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(
      menu.getByRole('menuitemradio', { name: new RegExp(boss.email) })
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(switcher(page)).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(
      menu.getByRole('menuitemradio', { name: new RegExp(user.email) })
    ).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(
      menu.getByRole('menuitemradio', { name: new RegExp(boss.email) })
    ).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(switcher(page)).toContainText(`Viewing ${boss.email}`)
  })
})
