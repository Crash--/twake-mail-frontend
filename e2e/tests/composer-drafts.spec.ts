import { ComposerPage, LoginPage } from '../pages'
import { DRAFT_IDLE_MS } from '../pages/ComposerPage'
import { keptComposers } from '../support/composerStorage'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'
import { recordJmapTraffic } from '../support/jmapTraffic'

async function draftSubjects(jmap: JmapClient): Promise<string[]> {
  const accountId = await jmap.accountId()
  const mailbox = await jmap.findMailboxByRole('drafts')
  const [, got] = await jmap.request([
    ['Email/query', { accountId, filter: { inMailbox: mailbox.id } }, 'q'],
    [
      'Email/get',
      {
        accountId,
        '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
        properties: ['subject']
      },
      'g'
    ]
  ])
  const list = (got?.[1] as { list: { subject: string }[] } | undefined)?.list
  return (list ?? []).map(email => email.subject)
}

/**
 * Autosave is local first (issue #134, docs/composer-drafts.md): typing writes
 * in the browser only, the server draft is written after five minutes
 * without a change, and only when the message differs from the saved one.
 */
test.describe('composer drafts, local first', () => {
  test('CMP-64 typing for two minutes writes nothing on the server', async ({
    page,
    user
  }) => {
    await page.clock.install()
    const traffic = recordJmapTraffic(page)
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    traffic.reset()

    await composer.fill({ to: ['kept@example.com'], subject: 'Two minutes' })
    await composer.editor.click()
    // Twelve bursts, ten seconds apart: two minutes of an author thinking
    for (let burst = 0; burst < 12; burst += 1) {
      await page.keyboard.type(`Sentence number ${burst}. `)
      await page.clock.runFor(10_000)
    }

    // Reported by the issue: the count before this change was 12 creations
    // and 11 destructions for this scenario
    console.log('JMAP email writes after two minutes of typing', traffic.writes())
    expect(traffic.writes().total).toBe(0)
    expect(traffic.methods().filter(name => name === 'Email/set')).toEqual([])
    // Kept in the browser meanwhile
    await expect
      .poll(async () => (await keptComposers(page)).map(kept => kept.subject))
      .toEqual(['Two minutes'])
  })

  test('CMP-65 a composer comes back after a reload with what was typed, in a new tab of the browser too', async ({
    page,
    user,
    context
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({
      to: ['kept@example.com'],
      subject: 'Typed, then reloaded',
      body: 'Body kept'
    })
    await expect
      .poll(async () => (await keptComposers(page)).map(kept => kept.subject))
      .toEqual(['Typed, then reloaded'])

    await page.reload()
    await new LoginPage(page).loginAs(user)
    const restored = new ComposerPage(page)
    await expect(restored.subjectInput).toHaveValue('Typed, then reloaded')
    await expect(restored.editor).toContainText('Body kept')

    // The tab closed (a new session): another one reopens it
    await page.close()
    const next = await context.newPage()
    await new LoginPage(next).loginAs(user)
    const again = new ComposerPage(next)
    await expect(again.subjectInput).toHaveValue('Typed, then reloaded')
    await expect(again.editor).toContainText('Body kept')
  })

  test('CMP-66 the draft is written once after five minutes without a change, and not again while it is unchanged', async ({
    page,
    user,
    jmap
  }) => {
    await page.clock.install()
    const traffic = recordJmapTraffic(page)
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({
      to: [user.email],
      subject: 'One write',
      body: 'Text'
    })
    traffic.reset()

    await page.clock.runFor(DRAFT_IDLE_MS - 5000)
    expect(traffic.writes().total).toBe(0)

    await page.clock.runFor(10_000)
    await expect(composer.saveStatus).toHaveText('Draft saved')
    expect(await draftSubjects(jmap)).toEqual(['One write'])
    expect(traffic.writes()).toMatchObject({ created: 1, destroyed: 0 })

    // Nothing changed: nothing written, however long it waits
    await page.clock.runFor(3 * DRAFT_IDLE_MS)
    expect(traffic.writes().total).toBe(1)

    // A real change: one more version, the previous one destroyed
    await composer.subjectInput.fill('Two writes')
    await composer.idle()
    await expect.poll(() => draftSubjects(jmap)).toEqual(['Two writes'])
    expect(traffic.writes()).toMatchObject({ created: 2, destroyed: 1 })
  })

  test('CMP-67 sending forgets the composer in the browser', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({
      to: [user.email],
      subject: 'Sent from local',
      body: 'Text'
    })
    await expect
      .poll(async () => (await keptComposers(page)).length)
      .toBe(1)

    await composer.send()

    await expect.poll(async () => keptComposers(page)).toEqual([])
  })

  test('CMP-68 signing out forgets the composers kept in the browser', async ({
    page,
    user
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({ subject: 'Not for the next user' })
    await expect
      .poll(async () => (await keptComposers(page)).length)
      .toBe(1)

    await page.getByTestId('user-avatar').click()
    await page.getByTestId('logout-button').click()
    await expect(page.getByTestId('login-username-input')).toBeVisible()

    await expect.poll(async () => keptComposers(page)).toEqual([])
    await new LoginPage(page).loginAs(user)
    await expect(page.getByTestId('composer')).toHaveCount(0)
  })

  test('CMP-69 a composer shown by a tab is not reopened by another tab', async ({
    page,
    user,
    context
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({ subject: 'Held by the first tab' })
    await expect
      .poll(async () => (await keptComposers(page)).length)
      .toBe(1)

    const other = await context.newPage()
    await new LoginPage(other).loginAs(user)

    await expect(other.getByTestId('composer')).toHaveCount(0)
    // Still kept for the first tab
    expect(await keptComposers(other)).toHaveLength(1)
    await expect(composer.subjectInput).toHaveValue('Held by the first tab')
  })
})
