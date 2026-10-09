import type { Frame, Page } from '@playwright/test'

import { ComposerPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import { SPACE_GREETING_SCRIPT } from '../support/spaceGreeting'
import type { E2ETeamMailbox, E2EUser } from '../support/users'
import type { WebAdminClient } from '../support/webadmin'

/**
 * The facade of a team mailbox, for the Mail tab of a TwakeSpace space
 * (ADR 010 of twake-space-architecture): `/embed/team-mailboxes/<id>`, the
 * id of its root folder, read from webadmin as the mail side service does
 */
async function facadePath(
  webadmin: WebAdminClient,
  team: E2ETeamMailbox
): Promise<string> {
  const [, domain = ''] = team.email.split('@')
  const root = (await webadmin.listTeamMailboxFolders(domain, team.name)).find(
    folder => folder.mailboxName === team.name
  )
  if (root === undefined) throw new Error(`No root for ${team.email}`)
  return `/embed/team-mailboxes/${root.mailboxId}`
}

const SPACE_HOST = '/space-host'

/** A page that frames the facade, as the Mail tab of TwakeSpace does */
function spaceHostHtml(src: string): string {
  return `<!doctype html>
<html lang="en"><head><title>Space</title></head><body style="margin:0">${SPACE_GREETING_SCRIPT}<iframe src="${src}" title="Mail" style="display:block;border:0;width:100vw;height:100vh"></iframe></body></html>`
}

/** Signs in with the credentials form the facade shows in basic mode */
async function signIn(scope: Page | Frame, user: E2EUser): Promise<void> {
  await scope.getByTestId('login-username-input').fill(user.email)
  await scope.getByTestId('login-password-input').fill(user.password)
  await scope.getByTestId('login-submit-button').click()
}

test.describe('TMB team mailbox facade', () => {
  test('TMB-10 framed, the facade of a team mailbox opens its Inbox, without top bar nor sidebar', async ({
    page,
    user,
    users,
    jmap,
    webadmin
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const teamInbox = (await jmap.getMailboxes()).find(
      mailbox =>
        mailbox.namespace === `TeamMailbox[${team.email}]` &&
        mailbox.name === 'INBOX'
    )
    if (teamInbox === undefined) throw new Error('No INBOX in the team mailbox')
    await jmap.createEmailIn(teamInbox.id, { subject: 'For the whole team' })
    const path = await facadePath(webadmin, team)
    await page.route(`**${SPACE_HOST}`, route =>
      route.fulfill({ contentType: 'text/html', body: spaceHostHtml(path) })
    )

    await page.goto(SPACE_HOST)
    const frame = page.frameLocator('iframe')
    const scope = page
      .frames()
      .find(candidate => candidate !== page.mainFrame())
    if (scope === undefined) throw new Error('The facade did not load')
    await signIn(scope, user)

    await expect(frame.getByTestId('mailbox-page')).toHaveAttribute(
      'data-mailbox-id',
      teamInbox.id
    )
    await expect(
      frame
        .getByTestId('email-list-item')
        .filter({ hasText: 'For the whole team' })
    ).toBeVisible()
    await expect(frame.getByTestId('compose-email-button')).toBeVisible()
    await expect(frame.getByTestId('sidebar')).toBeHidden()
    await expect(frame.getByTestId('top-bar')).toBeHidden()
    expect(new URL(scope.url()).pathname).toBe(
      `${path}/mailbox/${teamInbox.id}`
    )
    await expectNoA11yViolations(page)
  })

  test('TMB-15 framed between the tablet sizes, the facade has the desktop layout', async ({
    page,
    user,
    users,
    jmap,
    webadmin
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const teamInbox = (await jmap.getMailboxes()).find(
      mailbox =>
        mailbox.namespace === `TeamMailbox[${team.email}]` &&
        mailbox.name === 'INBOX'
    )
    if (teamInbox === undefined) throw new Error('No INBOX in the team mailbox')
    await jmap.createEmailIn(teamInbox.id, { subject: 'For the whole team' })
    const path = await facadePath(webadmin, team)
    await page.route(`**${SPACE_HOST}`, route =>
      route.fulfill({ contentType: 'text/html', body: spaceHostHtml(path) })
    )
    // A large tablet in the webmail: the list beside the reading pane
    await page.setViewportSize({ width: 1000, height: 800 })

    await page.goto(SPACE_HOST)
    const frame = page.frameLocator('iframe')
    const scope = page
      .frames()
      .find(candidate => candidate !== page.mainFrame())
    if (scope === undefined) throw new Error('The facade did not load')
    await signIn(scope, user)

    const row = frame
      .getByTestId('email-list-item')
      .filter({ hasText: 'For the whole team' })
    await expect(row).toBeVisible()
    await expect(frame.getByTestId('email-view-empty')).toBeHidden()

    await row.click()

    // Conversations by default: the email opens as one
    await expect(frame.getByTestId('conversation-view')).toBeVisible()
    await expect(row).toBeHidden()
    await expectNoA11yViolations(page)
  })

  test('TMB-11 a new message of the facade writes from the address of the team mailbox', async ({
    page,
    user,
    users,
    webadmin
  }) => {
    // After the identity of the user (`user-…`), the default one, by name
    const team = await users.createTeamMailbox({
      prefix: 'zz-team',
      members: [user]
    })

    await page.goto(await facadePath(webadmin, team))
    await signIn(page, user)
    await expect(page.getByTestId('mailbox-page')).toBeVisible()
    await page.getByTestId('compose-email-button').first().click()

    const composer = new ComposerPage(page)
    await expect(composer.root).toBeVisible()
    // Another identity than the default one: the From line shows it
    await expect(composer.identitySelect).toContainText(team.email)
  })

  test('TMB-12 the facade of a team mailbox the user is not a member of says so', async ({
    page,
    user,
    users,
    webadmin
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    const team = await users.createTeamMailbox({ members: [bob] })

    await page.goto(await facadePath(webadmin, team))
    await signIn(page, user)

    await expect(page.getByTestId('team-mailbox-unavailable')).toBeVisible()
    await expect(page.getByTestId('mailbox-page')).toBeHidden()
    await expectNoA11yViolations(page)
  })

  test('TMB-16 the link of an activity opens the email, in its folder', async ({
    page,
    user,
    users,
    jmap,
    webadmin
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const teamInbox = (await jmap.getMailboxes()).find(
      mailbox =>
        mailbox.namespace === `TeamMailbox[${team.email}]` &&
        mailbox.name === 'INBOX'
    )
    if (teamInbox === undefined) throw new Error('No INBOX in the team mailbox')
    const { id: emailId } = await jmap.createEmailIn(teamInbox.id, {
      subject: 'The one in the feed'
    })

    await page.goto(`${await facadePath(webadmin, team)}/email/${emailId}`)
    await signIn(page, user)

    await expect(
      page.getByRole('heading', { level: 1, name: 'The one in the feed' })
    ).toBeVisible()
    await expect(page).toHaveURL(
      new RegExp(`/mailbox/${teamInbox.id}/email/${emailId}$`)
    )
  })
})
