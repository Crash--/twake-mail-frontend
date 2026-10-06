import type { FrameLocator, Page } from '@playwright/test'

import { ComposerPage } from '../pages'
import { expect, test } from '../support/fixtures'
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
<button id="host-button" type="button">Host</button><output id="host-clicks">0</output>
<iframe id="facade" name="${FRAME}" title="Mail" src="${src}"></iframe>
<iframe id="overlay" name="${OVERLAY}" title="Mail windows" src="/embed/overlay.html"></iframe>
<script>
const overlay = document.getElementById('overlay')
const clicks = document.getElementById('host-clicks')
document.getElementById('host-button').onclick = () => { clicks.textContent = String(Number(clicks.textContent) + 1) }
let intentId = null
addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== overlay.contentWindow) return
  const data = event.data
  if (data.type === 'intent:ready') {
    intentId = crypto.randomUUID()
    overlay.contentWindow.postMessage({ type: 'intent:init', intentId, payload: { action: 'TWAKE_SURFACE', protocol: 'twake-surface/1', slot: 'overlay' } }, location.origin)
  } else if (data.type === 'twake-surface:region' && data.intentId === intentId) {
    const region = data.payload.region
    overlay.style.clipPath = region === 'full' ? 'none' : region.length === 0 ? 'inset(0 0 100% 0)'
      : "path('" + region.map(b => 'M' + b.x + ' ' + b.y + 'h' + b.width + 'v' + b.height + 'h' + -b.width + 'Z').join(' ') + "')"
  }
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
  await page.route('**/.env.js', async route => {
    const response = await route.fetch()
    const body = `${await response.text()}\nvar TWAKE_SPACE_URL = window.location.origin\n`
    await route.fulfill({ response, body })
  })
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
})
