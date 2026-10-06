import { LoadingPage, LoginPage, MailboxPage, SearchPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'
import { holdJmapMethods } from '../support/jmapGate'
import { recordJmapTraffic } from '../support/jmapTraffic'

const LONG_TEXT =
  'A body long enough to give the row a preview that fills two lines of the narrow rows. '.repeat(
    8
  )

/** Emails that are both in the Inbox and in the Trash (`saveTo`), with a long preview */
async function seedTrash(
  jmap: JmapClient,
  to: string,
  subjects: readonly string[]
): Promise<void> {
  for (const subject of subjects) {
    await jmap.sendEmail({ to, subject, text: LONG_TEXT, saveTo: 'trash' })
  }
  await jmap.waitForEmail({ subject: subjects[0] ?? '', mailboxRole: 'trash' })
}

const SUBJECTS = ['Skeleton one', 'Skeleton two', 'Skeleton three']

test.describe('LOAD loading states', () => {
  test('LOAD-01 the list shows rows of the real geometry while it loads, and nothing moves when the emails land', { tag: '@mobile' }, async ({
    page,
    user,
    jmap
  }) => {
    await seedTrash(jmap, user.email, SUBJECTS)
    const loading = new LoadingPage(page)
    const mailbox = await new LoginPage(page).loginAs(user)
    const gate = await holdJmapMethods(page, ['Email/query'])
    await loading.watchLayoutShift()
    // A slow machine, as CI: the rows of the table arrive one frame after another
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

    await mailbox.openFolder({ role: 'trash' })
    await expect(loading.listSkeleton).toBeVisible()
    await expect(loading.listSkeleton).toHaveAttribute('aria-busy', 'true')
    expect(await loading.isHiddenToScreenReaders(loading.firstSkeletonRow)).toBe(
      true
    )
    // Said once, whatever the number of skeletons on the page
    await expect(loading.loadingAnnouncement).toHaveText(/Loading/)
    const skeletonRow = await loading.box(loading.firstSkeletonRow)
    const toolbar = await loading.box(page.getByTestId('list-toolbar'))
    const toolbarButtons = page.getByTestId('list-toolbar').getByRole('button')
    const buttonsBefore = await loading.boxes(toolbarButtons)

    gate.release()
    const firstRow = loading.firstRow(mailbox.emailList)
    await expect(firstRow).toBeVisible()
    await expect(loading.listSkeleton).toBeHidden()

    const isNarrow = (page.viewportSize()?.width ?? 0) < 1200
    loading.expectSameBox(
      await loading.box(firstRow),
      skeletonRow,
      isNarrow ? 3 : 1,
      'first row'
    )
    loading.expectSameBox(
      await loading.box(page.getByTestId('list-toolbar')),
      toolbar,
      0,
      'toolbar'
    )
    // The buttons of the toolbar stay where they were (Select all is there
    // from the start, not yet usable)
    const buttonsAfter = await loading.boxes(toolbarButtons)
    expect(buttonsAfter).toHaveLength(buttonsBefore.length)
    buttonsAfter.forEach((box, index) => {
      loading.expectSameBox(
        box,
        buttonsBefore[index] ?? box,
        1,
        `toolbar button ${index}`
      )
    })
    expect(
      await loading.layoutShift(),
      await loading.layoutShiftSources()
    ).toBeLessThan(0.01)
    await expect(loading.loadingAnnouncement).toBeEmpty()
  })

  test('LOAD-02 the folders and the list load under one announcement, the tree on the boxes of its rows', { tag: '@mobile' }, async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'First', text: 'Hi' })
    await jmap.waitForEmail({ subject: 'First' })
    const loading = new LoadingPage(page)
    const login = new LoginPage(page)
    await login.goto()
    const gate = await holdJmapMethods(page, ['Mailbox/get'])
    await login.usernameInput.fill(user.email)
    await login.passwordInput.fill(user.password)
    await login.submitButton.click()

    await expect(loading.listSkeleton).toBeVisible()
    await expect(loading.loadingAnnouncement).toHaveText(/Loading/)
    expect(
      await page.getByText('Loading... Please wait!').count()
    ).toBe(1)
    const treeVisible = !new MailboxPage(page).hasFolderDrawer()
    let skeletonRow = null
    let titleBefore = null
    if (treeVisible) {
      await expect(loading.treeSkeleton).toBeVisible()
      titleBefore = await loading.box(page.getByTestId('mailbox-tree-title'))
      await expect(loading.treeSkeleton).toHaveAttribute('aria-busy', 'true')
      skeletonRow = await loading.box(
        loading.treeSkeleton.locator('.MuiSkeleton-circular, .MuiSkeleton-rounded').first().locator('..')
      )
    }

    gate.release()
    const ready = await new MailboxPage(page).expectLoaded()
    await expect(loading.treeSkeleton).toBeHidden()
    await expect(loading.listSkeleton).toBeHidden()
    if (skeletonRow !== null) {
      loading.expectSameBox(
        await loading.box(ready.folderTree.getByTestId('mailbox-item').first()),
        skeletonRow,
        1,
        'first folder'
      )
    }
    if (titleBefore !== null) {
      // The "Folders" title does not jump when the rows of the system folders land
      loading.expectSameBox(
        await loading.box(page.getByTestId('mailbox-tree-title')),
        titleBefore,
        1,
        'Folders title'
      )
    }
  })

  test('LOAD-03 an opening conversation shows its toolbar and the shapes of its subject, header and body', { tag: '@mobile' }, async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'Open me', text: LONG_TEXT })
    await jmap.waitForEmail({ subject: 'Open me' })
    const loading = new LoadingPage(page)
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emailRow('Open me')).toBeVisible()
    const gate = await holdJmapMethods(page, ['Email/get', 'Thread/get'])

    await mailbox.emailRow('Open me').click()
    await expect(loading.readingSkeleton).toBeVisible()
    await expect(loading.readingSkeleton).toHaveAttribute('aria-busy', 'true')
    expect(await loading.isHiddenToScreenReaders(loading.readingSkeleton.locator('.MuiSkeleton-root').first())).toBe(true)
    await expect(loading.loadingAnnouncement).toHaveText(/Loading/)
    // The way back is there before the email
    await expect(page.getByTestId('email-view-back-button')).toBeVisible()
    const toolbar = await loading.box(page.getByTestId('conversation-toolbar').or(page.getByTestId('email-view-back-button').locator('..')))
    const skeleton = await loading.box(loading.readingSkeleton)
    await expectNoA11yViolations(page)

    gate.release()
    await expect(page.getByTestId('conversation-subject')).toBeVisible()
    await expect(loading.readingSkeleton).toBeHidden()
    loading.expectSameBox(
      await loading.box(page.getByTestId('conversation-toolbar')),
      toolbar,
      1,
      'toolbar'
    )
    expect(
      Math.abs(
        (await loading.box(page.getByTestId('conversation-header'))).y - skeleton.y
      )
    ).toBeLessThanOrEqual(1)
  })

  test('LOAD-04 the results of a search show the rows while they load', { tag: '@mobile' }, async ({
    page,
    user,
    jmap
  }) => {
    await jmap.sendEmail({ to: user.email, subject: 'Findable kiwi', text: LONG_TEXT })
    await jmap.waitForEmail({ subject: 'Findable kiwi' })
    const loading = new LoadingPage(page)
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emailRow('Findable kiwi')).toBeVisible()
    const search = new SearchPage(page)
    await search.type('kiwi')
    const gate = await holdJmapMethods(page, ['Email/query'])
    await search.input.press('Enter')

    await expect(search.results).toBeVisible()
    await expect(loading.listSkeleton).toBeVisible()
    await expect(loading.listSkeleton).toHaveAttribute('aria-busy', 'true')
    const skeletonRow = await loading.box(loading.firstSkeletonRow)
    await expectNoA11yViolations(page)

    gate.release()
    await expect(search.resultRow('Findable kiwi')).toBeVisible()
    await expect(loading.listSkeleton).toBeHidden()
    const isNarrow = (page.viewportSize()?.width ?? 0) < 1200
    loading.expectSameBox(
      await loading.box(search.resultRow('Findable kiwi')),
      skeletonRow,
      isNarrow ? 3 : 1,
      'first result'
    )
  })

  test('LOAD-05 the skeletons pulse, and stand still when the user asks for less motion', { tag: '@mobile' }, async ({
    page,
    user
  }) => {
    const loading = new LoadingPage(page)
    const mailbox = await new LoginPage(page).loginAs(user)
    const gate = await holdJmapMethods(page, ['Email/query'])

    await mailbox.openFolder({ role: 'trash' })
    const shape = loading.listSkeleton.locator('.MuiSkeleton-root').first()
    await expect(shape).toBeVisible()
    await expect(shape).not.toHaveCSS('animation-name', 'none')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(shape).toHaveCSS('animation-name', 'none')
    gate.release()
  })
})

test.describe('OFF offline banner', () => {
  test('OFF-01 the banner shows while offline, said once politely, and Dismiss hides it', { tag: '@mobile' }, async ({
    page,
    context,
    user
  }) => {
    const loading = new LoadingPage(page)
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(loading.offlineBanner).toBeHidden()

    await context.setOffline(true)

    await expect(loading.offlineBanner).toBeVisible()
    await expect(loading.offlineBanner).toHaveText(/No internet connection/)
    await expect(loading.networkAnnouncement).toHaveText(
      'No internet connection'
    )
    // A polite region of its own, not an alert that would interrupt
    await expect(loading.networkAnnouncement).toHaveAttribute('role', 'status')
    await expect(loading.offlineBanner).not.toHaveAttribute('role', 'alert')
    // The app keeps what it has; an empty list says why (OFF-03)
    await expect(mailbox.emailList.or(loading.offlineListView)).toBeVisible()
    await expectNoA11yViolations(page)

    await loading.offlineBanner.getByRole('button', { name: 'Dismiss' }).click()
    await expect(loading.offlineBanner).toBeHidden()
    await expect(loading.networkAnnouncement).toBeEmpty()
    await context.setOffline(false)
  })

  test('OFF-02 back online the banner goes away and what arrived meanwhile is caught up from the changes, without a global refetch', { tag: '@mobile' }, async ({
    page,
    context,
    user,
    jmap
  }) => {
    const loading = new LoadingPage(page)
    // The push channel goes down with the network: what arrives meanwhile
    // is for the catch-up, not for the push
    const offlineSockets: { close: () => void }[] = []
    await page.routeWebSocket(/\/jmap\/ws/, socket => {
      socket.connectToServer()
      offlineSockets.push(socket)
    })
    await jmap.sendEmail({ to: user.email, subject: 'Before', text: 'Hi' })
    await jmap.waitForEmail({ subject: 'Before' })
    const mailbox = await new LoginPage(page).loginAs(user)
    await expect(mailbox.emailRow('Before')).toBeVisible()

    await context.setOffline(true)
    for (const socket of offlineSockets) socket.close()
    await expect(loading.offlineBanner).toBeVisible()
    await jmap.sendEmail({ to: user.email, subject: 'Arrived offline', text: 'Hi' })
    await jmap.waitForEmail({ subject: 'Arrived offline' })
    await expect(mailbox.emailRow('Arrived offline')).toBeHidden()

    const traffic = recordJmapTraffic(page)
    await context.setOffline(false)

    await expect(loading.offlineBanner).toBeHidden()
    await expect(mailbox.emailRow('Arrived offline')).toBeVisible()
    await expect(loading.networkAnnouncement).toHaveText('Back online')
    expect(traffic.methods()).toContain('Email/changes')
    // No list reloaded from scratch, no whole list of folders
    expect(traffic.methods()).not.toContain('Email/query')
    expect(
      traffic
        .calls()
        .filter(
          call =>
            call.name === 'Mailbox/get' &&
            typeof call.args === 'object' &&
            call.args !== null &&
            'ids' in call.args &&
            call.args.ids === null
        )
    ).toHaveLength(0)
    await expect(loading.listSkeleton).toBeHidden()
    await expect(loading.networkAnnouncement).toBeEmpty()
  })

  test('OFF-03 offline, a folder not loaded yet says there is no connection, then lists its emails once back', { tag: '@mobile' }, async ({
    page,
    context,
    user,
    jmap
  }) => {
    const loading = new LoadingPage(page)
    await jmap.sendEmail({ to: user.email, subject: 'Filed', text: 'Hi', saveTo: 'trash' })
    await jmap.waitForEmail({ subject: 'Filed', mailboxRole: 'trash' })
    const mailbox = await new LoginPage(page).loginAs(user)

    await context.setOffline(true)
    await expect(loading.offlineBanner).toBeVisible()
    await mailbox.openFolder({ role: 'trash' })

    await expect(loading.offlineListView).toHaveText(
      'No internet connection, try again later.'
    )
    await expect(loading.listSkeleton).toBeHidden()
    await expectNoA11yViolations(page)

    await context.setOffline(false)

    await expect(mailbox.emailRow('Filed')).toBeVisible()
    await expect(loading.offlineListView).toBeHidden()
  })

  test('OFF-04 a message sent offline stays in the composer, which says the user is offline, and goes once back', { tag: '@mobile' }, async ({
    page,
    context,
    user,
    users,
    jmapFor
  }) => {
    const bob = await users.create({ prefix: 'bob' })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({ to: [bob.email], subject: 'Sent offline', body: 'Hi' })

    await context.setOffline(true)
    await composer.sendButton.click()

    await expect(composer.sendError).toHaveText(
      'You are offline. It looks like you are not connected.'
    )
    await expect(composer.root).toBeVisible()
    await expect(composer.subjectInput).toHaveValue('Sent offline')

    await context.setOffline(false)
    await composer.send()

    await expect(mailbox.toast).toContainText('Message has been sent successfully')
    await jmapFor(bob).waitForEmail({ subject: 'Sent offline' })
  })
})

test.describe('LOAD in the facade of a team mailbox', () => {
  test('LOAD-06 framed, the facade shows the list skeleton without a sidebar, and the offline banner above its floating button', { tag: '@mobile' }, async ({
    page,
    context,
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
    const [, domain = ''] = team.email.split('@')
    const root = (
      await webadmin.listTeamMailboxFolders(domain, team.name)
    ).find(folder => folder.mailboxName === team.name)
    if (root === undefined) throw new Error(`No root for ${team.email}`)
    const host = '/space-host'
    await page.route(`**${host}`, route =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="en"><head><title>Space</title></head><body style="margin:0"><iframe src="/embed/team-mailboxes/${root.mailboxId}" title="Mail" style="display:block;border:0;width:100vw;height:100vh"></iframe></body></html>`
      })
    )
    await page.goto(host)
    const frame = page.frameLocator('iframe')
    const scope = page.frames().find(candidate => candidate !== page.mainFrame())
    if (scope === undefined) throw new Error('The facade did not load')
    const gate = await holdJmapMethods(page, ['Email/query'])
    await scope.getByTestId('login-username-input').fill(user.email)
    await scope.getByTestId('login-password-input').fill(user.password)
    await scope.getByTestId('login-submit-button').click()

    await expect(frame.getByTestId('email-list-loading')).toBeVisible()
    await expect(frame.getByTestId('email-list-loading')).toHaveAttribute(
      'aria-busy',
      'true'
    )
    await expect(frame.getByTestId('loading-announcement')).toHaveText(/Loading/)
    await expect(frame.getByTestId('sidebar')).toBeHidden()
    const skeleton = await frame
      .getByTestId('email-list-loading')
      .locator('tbody tr')
      .first()
      .boundingBox()

    gate.release()
    const row = frame.getByTestId('email-list-item').first()
    await expect(row).toBeVisible()
    const real = await row.boundingBox()
    expect(Math.abs((real?.y ?? 0) - (skeleton?.y ?? 99))).toBeLessThanOrEqual(1)

    await context.setOffline(true)
    const banner = frame.getByTestId('offline-banner')
    await expect(banner).toBeVisible()
    const bannerBox = await banner.boundingBox()
    const fabBox = await frame.getByTestId('compose-email-button').boundingBox()
    // Above the floating button, not under it
    expect((bannerBox?.y ?? 0) + (bannerBox?.height ?? 0)).toBeLessThanOrEqual(
      (fabBox?.y ?? 0) + 1
    )
    await context.setOffline(false)
    await expect(banner).toBeHidden()
  })
})
