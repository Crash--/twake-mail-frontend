import { ComposerPage, LoginPage, type MailboxPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { makePng } from '../support/clipboard'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'

/**
 * Templates (tmail-flutter "Save as template") and mailto links. The
 * Templates folder does not exist on a new account: the first "Save as
 * template" makes it, as tmail-flutter does at startup.
 */

interface Template {
  id: string
  subject: string
  keywords: Record<string, true>
  attachments: { name: string | null; cid: string | null }[]
}

/** The emails of the Templates folder (found by name, it has no role) */
async function readTemplates(jmap: JmapClient): Promise<Template[]> {
  const accountId = await jmap.accountId()
  const folder = await jmap.findMailboxByName('Templates')
  const [, got] = await jmap.request([
    ['Email/query', { accountId, filter: { inMailbox: folder.id } }, 'q'],
    [
      'Email/get',
      {
        accountId,
        '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
        // A body property before attachments (tmail-backend#2686)
        properties: ['htmlBody', 'attachments', 'subject', 'keywords'],
        bodyProperties: ['name', 'cid']
      },
      'g'
    ]
  ])
  return (got?.[1].list ?? []) as Template[]
}

/** Saves the message as a template, and says which toast came */
async function saveAsTemplate(
  composer: ComposerPage,
  mailbox: MailboxPage,
  toast: 'saved' | 'updated'
): Promise<void> {
  await composer.runMoreAction('save-template')
  await expect(mailbox.toast).toContainText(
    toast === 'saved'
      ? 'Save message to template folder successfully'
      : 'Update message to template folder successfully'
  )
}

/** Opens a template of the Templates folder in the composer */
async function openTemplate(
  mailbox: MailboxPage,
  subject: string
): Promise<ComposerPage> {
  await mailbox.openFolder({ name: 'Templates' })
  await mailbox.emailRowLink(subject).click()
  const composer = new ComposerPage(mailbox.page)
  await expect(composer.subjectInput).toHaveValue(subject)
  return composer
}

test.describe('CMP composer: templates and mailto links', () => {
  test('CMP-19 a message saved as a template is listed in Templates, and saved again as updated', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    let composer = await mailbox.compose()
    await composer.fill({ subject: 'test subject' })

    await saveAsTemplate(composer, mailbox, 'saved')
    await expectNoA11yViolations(page)
    // Kept as a template: closing asks nothing
    await composer.close()
    await expect(composer.root).toBeHidden()
    await mailbox.openFolder({ name: 'Templates' })
    await expect(mailbox.emailRow('test subject')).toBeVisible()

    composer = await openTemplate(mailbox, 'test subject')
    await composer.subjectInput.fill('test subject updated')
    await saveAsTemplate(composer, mailbox, 'updated')
    await composer.close()
    await expect(composer.root).toBeHidden()

    await expect(mailbox.emailRow('test subject updated')).toBeVisible()
    await expect(mailbox.emailRow('test subject')).toBeHidden()
    const templates = await readTemplates(jmap)
    expect(templates.map(template => template.subject)).toEqual([
      'test subject updated'
    ])
    expect(templates[0]?.keywords).toEqual({ $seen: true })
    // The drafts of the composers went with the templates
    const drafts = await jmap.findMailboxByRole('drafts')
    expect(await jmap.queryEmails({ inMailbox: drafts.id })).toEqual([])
  })

  for (const [id, kind] of [
    ['CMP-20', 'attachment'],
    ['CMP-21', 'inline image']
  ] as const) {
    test(`${id} a template with an ${kind}, reopened, is saved again twice`, async ({
      page,
      user,
      jmap
    }) => {
      const subject = `Template ${kind === 'attachment' ? 'file' : 'inline'}`
      const mailbox = await new LoginPage(page).loginAs(user)
      let composer = await mailbox.compose()
      await composer.fill({ to: [user.email], subject })
      const file = {
        name: kind === 'attachment' ? 'test-attachment.png' : 'test-inline.png',
        mimeType: 'image/png',
        buffer: await makePng(page, 120, 60, 'TPL')
      }
      if (kind === 'attachment') {
        await composer.attachFile(file)
      } else {
        await composer.editor.click()
        await composer.insertImage(file)
      }

      await saveAsTemplate(composer, mailbox, 'saved')
      await composer.close()
      await expect(composer.root).toBeHidden()

      composer = await openTemplate(mailbox, subject)
      for (const added of [' edited', ' again']) {
        await composer.subjectInput.press('End')
        await composer.subjectInput.pressSequentially(added)
        await saveAsTemplate(composer, mailbox, 'updated')
      }

      const [template, ...others] = await readTemplates(jmap)
      expect(others).toEqual([])
      expect(template?.subject).toBe(`${subject} edited again`)
      expect(template?.attachments.map(part => part.name)).toEqual([file.name])
      // An inline image keeps its Content-ID, a file has none
      expect(template?.attachments[0]?.cid !== undefined).toBe(
        kind === 'inline image'
      )
    })
  }

  test('CMP-24 a mailto link opened before signing in opens a composer with its fields', async ({
    page,
    user
  }) => {
    await page.goto(
      `/mailto?uri=${encodeURIComponent('mailto:shared-recipient@example.com?subject=Hello&body=World')}`
    )
    const login = new LoginPage(page)
    await expect(login.usernameInput).toBeVisible()

    await login.loginAs(user)

    const composer = new ComposerPage(page)
    await expect(composer.subjectInput).toHaveValue('Hello')
    await expect(composer.editor).toContainText('World')
    await expect(composer.recipients('to')).toHaveText([
      'shared-recipient@example.com'
    ])
    await expectNoA11yViolations(page)
  })
})
