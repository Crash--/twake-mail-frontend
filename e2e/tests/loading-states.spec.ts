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
    expect(await loading.layoutShift()).toBeLessThan(0.01)
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
    if (treeVisible) {
      await expect(loading.treeSkeleton).toBeVisible()
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
    // The app keeps what it has
    await expect(mailbox.emailList.or(mailbox.emptyListView)).toBeVisible()
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
})
