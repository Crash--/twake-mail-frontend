import type { Page } from '@playwright/test'

import { LoginPage } from '../pages'
import type { MailboxPage } from '../pages/MailboxPage'
import { expectNoA11yViolations } from '../support/a11y'
import { openAccountMenuIfAny } from '../support/accountMenu'
import { expect, test as base } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'
import {
  browserEndpoint,
  clickNotification,
  PushService,
  putInBackground,
  shownNotifications
} from '../support/webPush'

/**
 * `pushService`: the push service of the browser, played by the test
 * (support/webPush.ts). James posts to it for real; it hands the pushes to
 * the service worker of the app.
 */
const test = base.extend<{ pushService: PushService }>({
  pushService: async ({ context }, use) => {
    const service = await PushService.start()
    await service.givePushManager(context)
    await use(service)
    await service.stop()
    expect(service.failures, 'pushes not delivered to the worker').toEqual([])
  }
})

// Notifications need the full Chromium: its headless shell refuses them.
// They stay inside each browser: through the notification centre of the
// system, shared by the browsers of the parallel workers, some get lost
test.use({
  channel: 'chromium',
  permissions: ['notifications'],
  launchOptions: {
    slowMo: Number(process.env.E2E_SLOWMO ?? 0),
    args: ['--disable-features=SystemNotifications']
  }
})

/** What the worker shows alone: it holds no credentials to read the email */
const WORKER_NOTIFICATION = {
  title: 'New email',
  body: 'Open Twake Mail to read it.',
  tag: 'twake-mail-new-mail'
}

interface ServerSubscription {
  id: string
  types: string[]
}

/** The push subscriptions James keeps for the account */
async function serverSubscriptions(
  jmap: JmapClient
): Promise<ServerSubscription[]> {
  const [response] = await jmap.request([
    ['PushSubscription/get', { ids: null }, 'c0']
  ])
  return (response?.[1].list ?? []) as ServerSubscription[]
}

/** Settings > Preferences > "Show notifications" */
async function turnNotifications(
  page: Page,
  mailbox: MailboxPage,
  isOn: boolean,
  label = 'Show notifications'
): Promise<void> {
  const settings = await mailbox.openSettings()
  await settings.open('preferences')
  const toggle = page.getByRole('switch', { name: label })
  await expect(toggle).toBeChecked({ checked: !isOn })
  await toggle.click()
  await expect(toggle).toBeChecked({ checked: isOn })
}

/**
 * Signs in, turns the notifications on and waits until James verified the
 * subscription: it pushes to verified ones only
 */
async function subscribe(
  page: Page,
  user: { email: string; password: string },
  jmap: JmapClient,
  pushService: PushService
): Promise<MailboxPage> {
  const mailbox = await new LoginPage(page).loginAs(user)
  await pushService.deliverThrough(page)
  const verified = page.waitForRequest(
    request => request.postData()?.includes('verificationCode') ?? false
  )
  await turnNotifications(page, mailbox, true)
  await verified
  await expect.poll(() => serverSubscriptions(jmap)).toHaveLength(1)
  return mailbox
}

test.describe('WPUSH web push of new emails', () => {
  test('WPUSH-01 turning the notifications on subscribes the browser at the server, which then pushes each delivery', async ({
    page,
    user,
    users,
    jmap,
    jmapFor,
    pushService
  }) => {
    const sender = await users.create({ prefix: 'sender' })

    await subscribe(page, user, jmap, pushService)

    // One subscription, for the deliveries of emails only, proved by the
    // code James pushed to the endpoint of the browser
    expect(await serverSubscriptions(jmap)).toEqual([
      expect.objectContaining({ types: ['EmailDelivery'] })
    ])
    expect(pushService.of('PushVerification')).toHaveLength(1)
    expect(await browserEndpoint(page)).toBe(`${pushService.endpointBase}/1`)
    await expectNoA11yViolations(page)

    await jmapFor(sender).sendEmail({
      to: user.email,
      subject: 'Delivered',
      text: 'hi'
    })

    const accountId = await jmap.accountId()
    await expect
      .poll(() => pushService.of('StateChange').map(push => push.body))
      .toContainEqual(
        expect.objectContaining({
          changed: {
            [accountId]: { EmailDelivery: expect.any(String) as unknown }
          }
        })
      )
  })

  test('WPUSH-02 with the app in the background, a delivery shows the sender and the subject; a click opens the email', async ({
    page,
    context,
    user,
    users,
    jmap,
    jmapFor,
    pushService
  }) => {
    const sender = await users.create({ prefix: 'sender' })
    await subscribe(page, user, jmap, pushService)
    await putInBackground(page)

    await jmapFor(sender).sendEmail({
      to: user.email,
      subject: 'Lunch on Friday',
      text: 'hi'
    })

    const email = await jmap.waitForEmail({ subject: 'Lunch on Friday' })
    const inbox = await jmap.findMailboxByRole('inbox')
    const accountId = await jmap.accountId()
    // Once the push itself went through the worker: the page answered it,
    // the worker showed nothing of its own
    await expect.poll(() => pushService.of('StateChange').length).toBe(1)
    await expect
      .poll(() => shownNotifications(page))
      .toEqual([
        {
          title: sender.email,
          body: 'Lunch on Friday',
          tag: email.id,
          data: {
            url: `/mailbox/${inbox.id}/email/${email.id}`,
            accountId
          }
        }
      ])

    await clickNotification(context, email.id)

    await expect(
      page.getByRole('heading', { level: 1, name: 'Lunch on Friday' })
    ).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/email/${email.id}`))
    await expect.poll(() => shownNotifications(page)).toEqual([])
  })

  test('WPUSH-03 with no tab of the app left, a delivery shows the notification of the worker', async ({
    page,
    context,
    user,
    users,
    jmap,
    jmapFor,
    pushService
  }) => {
    const sender = await users.create({ prefix: 'sender' })
    await subscribe(page, user, jmap, pushService)
    // A page of the origin that is not the app: it answers the worker nothing
    const other = await context.newPage()
    await other.goto('/robots.txt')
    await pushService.deliverThrough(other)
    await page.close()

    await jmapFor(sender).sendEmail({
      to: user.email,
      subject: 'While away',
      text: 'hi'
    })

    await expect.poll(() => pushService.of('StateChange').length).toBe(1)
    await expect
      .poll(() => shownNotifications(other), { timeout: 20_000 })
      .toEqual([
        { ...WORKER_NOTIFICATION, data: { url: '/', accountId: null } }
      ])
  })

  test('WPUSH-04 a tab that cannot read the new emails leaves the notification to the worker; a click on it opens the mail', async ({
    page,
    context,
    user,
    users,
    jmap,
    jmapFor,
    pushService
  }) => {
    const sender = await users.create({ prefix: 'sender' })
    // The live channel of the tab never opens: it does not know what is new
    await page.route('**/jmap/ws/ticket', route => route.abort())
    await subscribe(page, user, jmap, pushService)
    await putInBackground(page)

    await jmapFor(sender).sendEmail({
      to: user.email,
      subject: 'Channel down',
      text: 'hi'
    })

    await expect
      .poll(() => shownNotifications(page))
      .toEqual([expect.objectContaining(WORKER_NOTIFICATION)])

    // From the settings, where the notifications were turned on
    await clickNotification(context, WORKER_NOTIFICATION.tag)

    await expect(page).toHaveURL(/\/mailbox\//)
    await expect.poll(() => shownNotifications(page)).toEqual([])
  })

  test('WPUSH-05 turning the notifications off removes the subscription: nothing is pushed any more', async ({
    page,
    user,
    users,
    jmap,
    jmapFor,
    pushService
  }) => {
    const sender = await users.create({ prefix: 'sender' })
    await subscribe(page, user, jmap, pushService)
    const toggle = page.getByRole('switch', { name: 'Show notifications' })

    await toggle.click()

    await expect(toggle).not.toBeChecked()
    await expect.poll(() => serverSubscriptions(jmap)).toEqual([])
    expect(await browserEndpoint(page)).toBe(null)
    await jmapFor(sender).sendEmail({
      to: user.email,
      subject: 'Unannounced',
      text: 'hi'
    })
    await jmap.waitForEmail({ subject: 'Unannounced' })
    expect(pushService.of('StateChange')).toEqual([])
    expect(await shownNotifications(page)).toEqual([])
  })

  test('WPUSH-06 signing out removes the subscription from the server and the browser', async ({
    page,
    user,
    jmap,
    pushService
  }) => {
    await subscribe(page, user, jmap, pushService)

    await openAccountMenuIfAny(page)
    await page.getByTestId('logout-button').click()

    await expect(new LoginPage(page).usernameInput).toBeVisible()
    await expect.poll(() => serverSubscriptions(jmap)).toEqual([])
    expect(await browserEndpoint(page)).toBe(null)
  })

  test('WPUSH-07 opening the app again renews the subscription instead of making another', async ({
    page,
    user,
    users,
    jmap,
    jmapFor,
    pushService
  }) => {
    const sender = await users.create({ prefix: 'sender' })
    await subscribe(page, user, jmap, pushService)
    const [before] = await serverSubscriptions(jmap)

    const renewed = page.waitForRequest(
      request => request.postData()?.includes('"expires"') ?? false
    )
    // The page is loaded again: the session of the basic mode is gone
    await page.goto('/')
    await new LoginPage(page).loginAfterReload(user)
    await renewed

    expect(await serverSubscriptions(jmap)).toEqual([
      expect.objectContaining({ id: before?.id })
    ])
    expect(pushService.of('PushVerification')).toHaveLength(1)
    // Still pushed to
    await jmapFor(sender).sendEmail({
      to: user.email,
      subject: 'After the reload',
      text: 'hi'
    })
    await expect.poll(() => pushService.of('StateChange').length).toBe(1)
  })

  test('WPUSH-08 a subscription whose verification code never reached the browser is replaced at the next opening', async ({
    page,
    user,
    users,
    jmap,
    jmapFor,
    pushService
  }) => {
    const sender = await users.create({ prefix: 'sender' })
    // Nothing delivers the pushes to the worker yet: the code is lost
    const mailbox = await new LoginPage(page).loginAs(user)
    await turnNotifications(page, mailbox, true)
    await expect.poll(() => pushService.of('PushVerification').length).toBe(1)
    const [unverified] = await serverSubscriptions(jmap)
    await jmapFor(sender).sendEmail({
      to: user.email,
      subject: 'Not pushed',
      text: 'hi'
    })
    await jmap.waitForEmail({ subject: 'Not pushed' })
    expect(pushService.of('StateChange')).toEqual([])

    await pushService.deliverThrough(page)
    const verified = page.waitForRequest(
      request => request.postData()?.includes('verificationCode') ?? false
    )
    // The page is loaded again: the session of the basic mode is gone
    await page.goto('/')
    await new LoginPage(page).loginAfterReload(user)
    await verified

    await expect.poll(() => pushService.of('PushVerification').length).toBe(2)
    const after = await serverSubscriptions(jmap)
    expect(after).toHaveLength(1)
    expect(after[0]?.id).not.toBe(unverified?.id)
    await jmapFor(sender).sendEmail({
      to: user.email,
      subject: 'Pushed at last',
      text: 'hi'
    })
    await expect.poll(() => pushService.of('StateChange').length).toBe(1)
  })

  test('WPUSH-09 the notification of the worker speaks the language of the user', async ({
    page,
    context,
    user,
    users,
    jmapFor,
    pushService
  }) => {
    const sender = await users.create({ prefix: 'sender' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await pushService.deliverThrough(page)
    const settings = await mailbox.openSettings()
    await settings.open('language-region')
    await page.getByTestId('language-select').click()
    await page.getByRole('option', { name: 'French - Français' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    const verified = page.waitForRequest(
      request => request.postData()?.includes('verificationCode') ?? false
    )
    await turnNotifications(page, mailbox, true, 'Afficher les notifications')
    await verified
    const other = await context.newPage()
    await other.goto('/robots.txt')
    await pushService.deliverThrough(other)
    await page.close()

    await jmapFor(sender).sendEmail({
      to: user.email,
      subject: 'En français',
      text: 'hi'
    })

    await expect
      .poll(() => shownNotifications(other), { timeout: 20_000 })
      .toEqual([
        expect.objectContaining({
          title: 'Nouveau mail',
          body: 'Ouvrez Twake Mail pour le lire.'
        })
      ])
  })
})
