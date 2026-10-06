import type { Frame, Page } from '@playwright/test'

import { ComposerPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import type { E2EUser } from '../support/users'

/**
 * The facade of a team mailbox, for the Mail tab of a TwakeSpace space
 * (ADR 010 of twake-space-architecture): `/embed/team-mailboxes/<address>`
 */
function facadePath(address: string): string {
  return `/embed/team-mailboxes/${encodeURIComponent(address)}`
}

const SPACE_HOST = '/space-host'

/** A page that frames the facade, as the Mail tab of TwakeSpace does */
function spaceHostHtml(src: string): string {
  return `<!doctype html>
<html lang="en"><head><title>Space</title></head><body style="margin:0"><iframe src="${src}" title="Mail" style="display:block;border:0;width:100vw;height:100vh"></iframe></body></html>`
}

/** Signs in with the credentials form the facade shows in basic mode */
async function signIn(scope: Page | Frame, user: E2EUser): Promise<void> {
  await scope.getByTestId('login-username-input').fill(user.email)
  await scope.getByTestId('login-password-input').fill(user.password)
  await scope.getByTestId('login-submit-button').click()
}

test.describe('TMB team mailbox facade', () => {
  test('TMB-10 framed, the facade of a team mailbox opens its Inbox with its folders only', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const other = await users.createTeamMailbox({
      prefix: 'other',
      members: [user]
    })
    const teamInbox = (await jmap.getMailboxes()).find(
      mailbox =>
        mailbox.namespace === `TeamMailbox[${team.email}]` &&
        mailbox.name === 'INBOX'
    )
    if (teamInbox === undefined) throw new Error('No INBOX in the team mailbox')
    await jmap.createEmailIn(teamInbox.id, { subject: 'For the whole team' })
    await page.route(`**${SPACE_HOST}`, route =>
      route.fulfill({
        contentType: 'text/html',
        body: spaceHostHtml(facadePath(team.email))
      })
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
    await expect(frame.getByTestId('team-mailbox-title')).toHaveText(team.name)
    const tree = frame.getByTestId('mailbox-tree')
    await expect(tree.getByTestId('mailbox-item-name')).toHaveText([
      'INBOX',
      'Drafts',
      'Outbox',
      'Sent',
      'Trash',
      'Templates'
    ])
    await expect(tree).not.toContainText(other.name)
    await expect(frame.getByTestId('top-bar')).toBeHidden()
    expect(new URL(scope.url()).pathname).toBe(
      `${facadePath(team.email)}/mailbox/${teamInbox.id}`
    )
    await expectNoA11yViolations(page)
  })

  test('TMB-11 a new message of the facade writes from the address of the team mailbox', async ({
    page,
    user,
    users
  }) => {
    // After the identity of the user (`user-…`), the default one, by name
    const team = await users.createTeamMailbox({
      prefix: 'zz-team',
      members: [user]
    })

    await page.goto(facadePath(team.email))
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
    users
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    const team = await users.createTeamMailbox({ members: [bob] })

    await page.goto(facadePath(team.email))
    await signIn(page, user)

    await expect(page.getByTestId('team-mailbox-unavailable')).toContainText(
      team.email
    )
    await expect(page.getByTestId('mailbox-page')).toBeHidden()
    await expectNoA11yViolations(page)
  })
})
