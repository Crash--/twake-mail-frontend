import type { FrameLocator, Page } from '@playwright/test'

import { ComposerPage } from '../pages'
import { expect, test } from '../support/fixtures'
import { SPACE_GREETING_SCRIPT } from '../support/spaceGreeting'
import type { E2ETeamMailbox, E2EUser } from '../support/users'
import type { WebAdminClient } from '../support/webadmin'

/**
 * The overlay of TwakeSpace (docs/team-mailbox-embed.md, "Overlay"): a host
 * page that frames the facade as TwakeSpace does, with a named frame and an
 * overlay frame over the whole page, clipped to the region the facade
 * reports. The facade puts its composer and its dialogs there, on the page
 * of the host, not in its frame.
 */

const HOST = '/space-host-overlay'
const FRAME = 'twake-embed-mail'
const OVERLAY = `${FRAME}:overlay`

/** The page of the host: the facade in a frame smaller than the window */
function hostHtml(src: string): string {
  return `<!doctype html>
<html lang="en"><head><title>Space</title><style>
body { margin: 0 }
#host-button { position: fixed; top: 8px; left: 8px }
#facade { position: fixed; top: 100px; left: 200px; width: 900px; height: 600px; border: 0 }
#overlay { position: fixed; inset: 0; width: 100%; height: 100%; border: 0; z-index: 10; color-scheme: normal; clip-path: inset(0 0 100% 0) }
</style></head><body>
${SPACE_GREETING_SCRIPT}
<button id="host-button" type="button">Host</button><output id="host-clicks">0</output>
<iframe id="facade" name="${FRAME}" title="Mail" src="${src}"></iframe>
<iframe id="overlay" name="${OVERLAY}" title="Mail windows" src="/embed/overlay.html"></iframe>
<script>
const overlay = document.getElementById('overlay')
const clicks = document.getElementById('host-clicks')
document.getElementById('host-button').onclick = () => { clicks.textContent = String(Number(clicks.textContent) + 1) }
const facade = document.getElementById('facade')
addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== facade.contentWindow) return
  if (event.data?.type !== 'twake-embed:overlay-region') return
  const region = event.data.region
  overlay.style.clipPath = region === 'full' ? 'none' : region.length === 0 ? 'inset(0 0 100% 0)'
    : "path('" + region.map(b => 'M' + b.x + ' ' + b.y + 'h' + b.width + 'v' + b.height + 'h' + -b.width + 'Z').join(' ') + "')"
})
</script></body></html>`
}

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

/** Opens the host page, its origin the one of TwakeSpace, and signs in */
async function openHost(
  page: Page,
  user: E2EUser,
  path: string
): Promise<{ facade: FrameLocator; overlay: FrameLocator }> {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route(`**${HOST}`, route =>
    route.fulfill({ contentType: 'text/html', body: hostHtml(path) })
  )
  await page.goto(HOST)
  const facade = page.frameLocator(`iframe[name="${FRAME}"]`)
  await facade.getByTestId('login-username-input').fill(user.email)
  await facade.getByTestId('login-password-input').fill(user.password)
  await facade.getByTestId('login-submit-button').click()
  await expect(facade.getByTestId('mailbox-page')).toBeVisible()
  return { facade, overlay: page.frameLocator(`iframe[name="${OVERLAY}"]`) }
}

function clipPath(page: Page): Promise<string> {
  return page
    .locator('#overlay')
    .evaluate(element => (element as HTMLElement).style.clipPath)
}

test.describe('TMB team mailbox facade on the overlay of TwakeSpace', () => {
  test('TMB-13 the composer opens at the bottom end of the host page, the page usable around it', async ({
    page,
    user,
    users,
    webadmin
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const { facade, overlay } = await openHost(
      page,
      user,
      await facadePath(webadmin, team)
    )
    expect(await clipPath(page)).toMatch(/^inset/)

    await facade.getByTestId('compose-email-button').first().click()
    const composer = new ComposerPage(page, overlay.getByTestId('composer'))
    await expect(composer.root).toBeVisible()
    await expect(facade.getByTestId('composer')).toHaveCount(0)
    await expect.poll(() => clipPath(page)).toMatch(/^path\(/)
    // At the bottom end of the window, past the frame (it ends at 1100 x 700)
    const box = await composer.root.boundingBox()
    expect(1440 - (box!.x + box!.width)).toBeLessThanOrEqual(30)
    expect(900 - (box!.y + box!.height)).toBeLessThanOrEqual(30)

    await composer.subjectInput.fill('From the page of the host')
    await expect(composer.subjectInput).toHaveValue('From the page of the host')
    // The host takes the clicks beside the composer
    await page.locator('#host-button').click()
    await expect(page.locator('#host-clicks')).toHaveText('1')

    // A dialog of the composer is centred on the window and blocks it all
    await composer.root.getByTestId('composer-close-button').click()
    const confirm = overlay.getByTestId('confirm-dialog')
    await expect(confirm).toBeVisible()
    await expect.poll(() => clipPath(page)).toBe('none')
    const dialog = await confirm.boundingBox()
    expect(Math.abs(dialog!.x + dialog!.width / 2 - 720)).toBeLessThan(2)
    expect(Math.abs(dialog!.y + dialog!.height / 2 - 450)).toBeLessThan(2)

    await confirm.getByTestId('confirm-dialog-alternative-button').click()
    await expect(overlay.getByTestId('composer')).toHaveCount(0)
    await expect.poll(() => clipPath(page)).toMatch(/^inset/)
  })

  test('TMB-14 a dialog opened from the facade shows on the host page and gives the focus back', async ({
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
    await jmap.createEmailIn(teamInbox.id, { subject: 'To be moved' })
    const { facade, overlay } = await openHost(
      page,
      user,
      await facadePath(webadmin, team)
    )

    await facade.getByTestId('email-list-item').first().click()
    const more = facade.getByTestId('email-view-more-button').first()
    await more.click()
    await facade.getByTestId('email-action-move').click()
    const picker = overlay.getByTestId('mailbox-picker')
    await expect(picker).toBeVisible()
    await expect(facade.getByTestId('mailbox-picker')).toHaveCount(0)
    await expect.poll(() => clipPath(page)).toBe('none')
    await expect(
      overlay.getByTestId('mailbox-picker-search-input')
    ).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(picker).toBeHidden()
    await expect.poll(() => clipPath(page)).toMatch(/^inset/)
    await expect(more).toBeFocused()
  })

  test('TMB-17 the link popup of the composer opens on the overlay, above the composer, under the caret (issue #1194)', async ({
    page,
    user,
    users,
    webadmin
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const { facade, overlay } = await openHost(
      page,
      user,
      await facadePath(webadmin, team)
    )
    await facade.getByTestId('compose-email-button').first().click()
    const composer = new ComposerPage(page, overlay.getByTestId('composer'))
    await composer.editor.click()
    await page.keyboard.type('Lunch on Friday')

    // Where the caret is, at the end of the text
    const caret = await composer.editor.evaluate(element => {
      const rect = element.ownerDocument
        .getSelection()!
        .getRangeAt(0)
        .getBoundingClientRect()
      return { left: rect.left, bottom: rect.bottom }
    })

    await page.keyboard.press('Control+K')

    const dialog = overlay.getByRole('dialog', { name: 'Insert link' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('link-dialog-url-input')).toBeFocused()
    await expect(
      facade.getByRole('dialog', { name: 'Insert link' })
    ).toHaveCount(0)
    // It paints on top at its centre: the overlay on the host page, then
    // itself on the overlay
    const box = await dialog.boundingBox()
    const centre = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
    expect(
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.id ?? null,
        centre
      )
    ).toBe('overlay')
    expect(
      await dialog.evaluate((element, { x, y }) => {
        const hit = element.ownerDocument.elementFromPoint(x, y)
        return hit !== null && element.contains(hit)
      }, centre)
    ).toBe(true)
    // Under the caret
    expect(Math.abs(box!.x - caret.left)).toBeLessThan(2)
    expect(box!.y).toBeGreaterThanOrEqual(caret.bottom)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(composer.editor).toBeFocused()
  })

  test('TMB-18 the recipient suggestions open whole on the overlay, under the field (issue #954)', async ({
    page,
    user,
    users,
    webadmin
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const stamp = Date.now()
    const surname = `Overlaid${stamp}`
    const contacts = ['Ada', 'Bea', 'Cid', 'Dan', 'Eva', 'Fay', 'Gus', 'Hal'].map(
      firstname => ({
        emailAddress: `${firstname.toLowerCase()}-${stamp}@example.com`,
        firstname,
        surname
      })
    )
    for (const contact of contacts)
      await webadmin.createDomainContact('example.com', contact)
    try {
      const { facade, overlay } = await openHost(
        page,
        user,
        await facadePath(webadmin, team)
      )
      await facade.getByTestId('compose-email-button').first().click()
      const composer = new ComposerPage(page, overlay.getByTestId('composer'))
      const input = composer.recipientInput('to')
      await input.fill(surname)
      const listbox = overlay.getByTestId('composer-to-suggestions')
      await expect(listbox.getByRole('option')).toHaveCount(contacts.length)

      // The popup the suggestions scroll in, at most 300 px high
      const popup = listbox.locator('xpath=..')
      const field = await input.boundingBox()
      const box = await popup.boundingBox()
      // Under the field it completes, starting where it starts
      expect(box!.y).toBeGreaterThanOrEqual(field!.y + field!.height - 1)
      expect(Math.abs(box!.x - field!.x)).toBeLessThan(1)
      // Every corner paints on top: the overlay on the host page, then the
      // suggestions on the overlay
      const corners = [
        { x: box!.x + 2, y: box!.y + 2 },
        { x: box!.x + box!.width - 2, y: box!.y + 2 },
        { x: box!.x + 2, y: box!.y + box!.height - 2 },
        { x: box!.x + box!.width - 2, y: box!.y + box!.height - 2 }
      ]
      for (const corner of corners) {
        expect(
          await page.evaluate(
            ({ x, y }) => document.elementFromPoint(x, y)?.id ?? null,
            corner
          )
        ).toBe('overlay')
        expect(
          await popup.evaluate((element, { x, y }) => {
            const hit = element.ownerDocument.elementFromPoint(x, y)
            return hit !== null && element.contains(hit)
          }, corner)
        ).toBe(true)
      }
    } finally {
      for (const contact of contacts)
        await webadmin.deleteDomainContact('example.com', contact.emailAddress)
    }
  })
})
