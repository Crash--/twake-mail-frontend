import { ComposerPage, LoginPage, SearchPage, type MailboxPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { makePng } from '../support/clipboard'
import { expect, test } from '../support/fixtures'
import type { JmapClient } from '../support/jmap'
import type { E2ETeamMailbox } from '../support/users'

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

/**
 * The Templates folder once it holds `count` emails. An update creates the new version, then
 * destroys the previous one; tmail-backend (memory) goes on listing and returning a destroyed
 * email for a moment after `Email/set` answered that it is gone (the next read no longer has it)
 */
async function readTemplatesSettled(
  jmap: JmapClient,
  count: number
): Promise<Template[]> {
  let templates: Template[] = []
  await expect
    .poll(async () => {
      templates = await readTemplates(jmap)
      return templates.map(template => template.subject)
    })
    .toHaveLength(count)
  return templates
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
    const templates = await readTemplatesSettled(jmap, 1)
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

      const [template] = await readTemplatesSettled(jmap, 1)
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

/** The own Templates folder, made as tmail-flutter does when it is missing */
async function ownTemplatesFolder(jmap: JmapClient): Promise<string> {
  return (await jmap.createMailbox({ name: 'Templates' })).id
}

/** The folders of a team mailbox, by name */
async function teamFolder(
  jmap: JmapClient,
  team: E2ETeamMailbox,
  name: string
): Promise<string> {
  return (
    await jmap.findMailboxByName(name, {
      namespace: `TeamMailbox[${team.email}]`
    })
  ).id
}

async function subjectsIn(
  jmap: JmapClient,
  mailboxId: string
): Promise<(string | null)[]> {
  return (await jmap.queryEmails({ inMailbox: mailboxId })).map(
    email => email.subject
  )
}

/** Templates written to be picked: a subject and a body */
async function seedTemplates(
  jmap: JmapClient,
  folderId: string,
  templates: Record<string, string>
): Promise<void> {
  for (const [subject, text] of Object.entries(templates)) {
    await jmap.createEmailIn(folderId, { subject, html: `<p>${text}</p>` })
  }
}

test.describe('CMP composer: templates follow-ups', () => {
  test('CMP-91 two tabs saving their first template at the same time make a single Templates folder', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const first = await mailbox.compose()
    await first.fill({ subject: 'First template' })
    // The Web Lock is shared by the tabs of the browser
    const other = await page.context().newPage()
    const otherMailbox = await new LoginPage(other).loginAs(user)
    const second = await otherMailbox.compose()
    await second.fill({ subject: 'Second template' })

    // Neither knows the folder the other is making
    await first.runMoreAction('save-template')
    await second.runMoreAction('save-template')

    const personal = async (): Promise<string[]> =>
      (await jmap.getMailboxes())
        .filter(
          folder =>
            folder.name.toLowerCase() === 'templates' &&
            folder.namespace === 'Personal'
        )
        .map(folder => folder.id)
    await expect
      .poll(async () => {
        const [folder] = await personal()
        return folder === undefined
          ? []
          : (await subjectsIn(jmap, folder)).sort()
      })
      .toEqual(['First template', 'Second template'])
    expect(await personal()).toHaveLength(1)
  })

  test('CMP-92 a reopened draft saved as a template leaves no draft behind', async ({
    page,
    user,
    jmap
  }) => {
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({ to: [user.email], subject: 'Draft to template' })
    await composer.closeAnd('save')
    const drafts = await jmap.findMailboxByRole('drafts')
    await expect
      .poll(() => subjectsIn(jmap, drafts.id))
      .toEqual(['Draft to template'])

    await mailbox.openFolder({ role: 'drafts' })
    await mailbox.emailRowLink('Draft to template').click()
    const reopened = new ComposerPage(page)
    await expect(reopened.subjectInput).toHaveValue('Draft to template')
    await saveAsTemplate(reopened, mailbox, 'saved')

    // Nothing to confirm: the draft is the user's own
    await expect(page.getByTestId('confirm-dialog')).toBeHidden()
    await expect.poll(() => subjectsIn(jmap, drafts.id)).toEqual([])
    const templates = await jmap.findMailboxByName('Templates')
    expect(await subjectsIn(jmap, templates.id)).toEqual(['Draft to template'])
  })

  test('CMP-93 the template of a message written as a team mailbox is filed in the Templates of the team mailbox, and opens with its identity', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const teamTemplates = await teamFolder(jmap, team, 'Templates')

    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.chooseIdentity(team.email)
    await composer.fill({ subject: 'Team template' })
    await saveAsTemplate(composer, mailbox, 'saved')
    await composer.close()
    await expect(composer.root).toBeHidden()

    await expect
      .poll(() => subjectsIn(jmap, teamTemplates))
      .toEqual(['Team template'])
    // None made for the user
    await expect(jmap.findMailboxByName('Templates')).rejects.toThrow()

    await mailbox.toggleFolder({ name: team.name })
    await mailbox.openFolder({ id: teamTemplates })
    await mailbox.emailRowLink('Team template').click()
    const reopened = new ComposerPage(page)
    await expect(reopened.subjectInput).toHaveValue('Team template')
    await expect(reopened.identitySelect).toContainText(team.email)
  })

  test('CMP-94 saving a draft of a team mailbox as a template asks before deleting it for the team', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    const teamDrafts = await teamFolder(jmap, team, 'Drafts')
    const teamTemplates = await teamFolder(jmap, team, 'Templates')

    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.chooseIdentity(team.email)
    await composer.fill({ to: [user.email], subject: 'Shared draft' })
    await composer.closeAnd('save')
    await expect
      .poll(() => subjectsIn(jmap, teamDrafts))
      .toEqual(['Shared draft'])

    await mailbox.toggleFolder({ name: team.name })
    await mailbox.openFolder({ id: teamDrafts })
    await mailbox.emailRowLink('Shared draft').click()
    const reopened = new ComposerPage(page)
    await expect(reopened.subjectInput).toHaveValue('Shared draft')

    await reopened.runMoreAction('save-template')
    const dialog = page.getByTestId('confirm-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Delete the shared draft?')
    await expectNoA11yViolations(page)
    // Cancelling saves nothing
    await dialog.getByTestId('confirm-dialog-cancel-button').click()
    await expect(dialog).toBeHidden()
    expect(await subjectsIn(jmap, teamTemplates)).toEqual([])
    expect(await subjectsIn(jmap, teamDrafts)).toEqual(['Shared draft'])

    await reopened.runMoreAction('save-template')
    await dialog.getByTestId('confirm-dialog-confirm-button').click()

    await expect(mailbox.toast).toContainText(
      'Save message to template folder successfully'
    )
    await expect.poll(() => subjectsIn(jmap, teamDrafts)).toEqual([])
    expect(await subjectsIn(jmap, teamTemplates)).toEqual(['Shared draft'])
  })

  test('CMP-95 the Insert template picker lists the templates, filters them, announces the results and inserts one with the keyboard', async ({
    page,
    user,
    users,
    jmap
  }) => {
    const team = await users.createTeamMailbox({ members: [user] })
    await seedTemplates(jmap, await ownTemplatesFolder(jmap), {
      'Weekly report': 'Done this week:',
      'Welcome aboard': 'Glad to have you with us'
    })
    await seedTemplates(jmap, await teamFolder(jmap, team, 'Templates'), {
      'Team handbook': 'Read the handbook'
    })

    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.openTemplatePicker()

    // Named, focus in the field, the own templates and the team ones
    await expect(composer.templatePicker).toHaveAccessibleName(
      'Insert a template'
    )
    await expect(composer.templatePickerInput).toBeFocused()
    await expect(composer.templatePickerInput).toHaveAccessibleName(
      'Search templates'
    )
    await expect(composer.templatePickerOptions).toHaveCount(3)
    await expectNoA11yViolations(page)

    await page.keyboard.type('hand')
    await expect(composer.templatePickerOptions).toHaveCount(1)
    await expect(composer.templatePickerResults).toHaveText('1 template found')
    await page.keyboard.press('Control+a')
    await page.keyboard.type('we')
    await expect(composer.templatePickerResults).toHaveText('2 templates found')

    await page.keyboard.type('lcome')
    await page.keyboard.press('Enter')

    // An empty message takes the subject and the body
    await expect(composer.templatePicker).toBeHidden()
    await expect(composer.subjectInput).toHaveValue('Welcome aboard')
    await expect(composer.editor).toContainText('Glad to have you with us')
    await expect(composer.editor).toBeFocused()
  })

  test('CMP-96 inserting a template into a message that has text asks whether to insert it at the cursor or to replace the message', async ({
    page,
    user,
    jmap
  }) => {
    await seedTemplates(jmap, await ownTemplatesFolder(jmap), {
      'Weekly report': 'Done this week:',
      'Welcome aboard': 'Glad to have you with us'
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const composer = await mailbox.compose()
    await composer.fill({ subject: 'My own subject', body: 'My own text' })
    const dialog = page.getByTestId('confirm-dialog')

    await composer.openTemplatePicker()
    await composer.templatePickerOptions.filter({ hasText: 'Weekly' }).click()
    await expect(dialog).toBeVisible()
    await expectNoA11yViolations(page)
    await dialog.getByTestId('confirm-dialog-confirm-button').click()
    await expect(dialog).toBeHidden()
    // Inserted at the cursor: the subject and the text stay
    await expect(composer.subjectInput).toHaveValue('My own subject')
    await expect(composer.editor).toContainText('My own text')
    await expect(composer.editor).toContainText('Done this week:')

    await composer.openTemplatePicker()
    await composer.templatePickerOptions.filter({ hasText: 'Welcome' }).click()
    await dialog.getByTestId('confirm-dialog-alternative-button').click()
    await expect(composer.subjectInput).toHaveValue('Welcome aboard')
    await expect(composer.editor).toContainText('Glad to have you with us')
    await expect(composer.editor).not.toContainText('My own text')

    // Closing the picker with Escape gives the focus back to the More button
    await composer.openTemplatePicker()
    await page.keyboard.press('Escape')
    await expect(composer.templatePicker).toBeHidden()
    await expect(composer.moreButton).toBeFocused()
  })

  test(
    'CMP-97 the Insert template picker opens as a sheet on a phone and a dialog elsewhere, and works by touch',
    { tag: '@mobile' },
    async ({ page, user, jmap }) => {
      await seedTemplates(jmap, await ownTemplatesFolder(jmap), {
        'Weekly report': 'Done this week:',
        'Welcome aboard': 'Glad to have you with us'
      })
      const size = page.viewportSize() ?? { width: 0, height: 0 }
      const mailbox = await new LoginPage(page).loginAs(user)
      const composer = await mailbox.compose()
      await composer.openTemplatePicker()

      const box = await composer.templatePicker.boundingBox()
      if (size.width < 600) {
        // A sheet from the bottom edge, as wide as the screen
        expect(box?.x).toBe(0)
        expect(box?.width).toBe(size.width)
        await expect
          .poll(async () => {
            const sheet = await composer.templatePicker.boundingBox()
            return Math.round((sheet?.y ?? 0) + (sheet?.height ?? 0))
          })
          .toBe(size.height)
      } else {
        // A dialog, centred
        const middle = (box?.x ?? 0) + (box?.width ?? 0) / 2
        expect(Math.abs(middle - size.width / 2)).toBeLessThan(2)
      }
      await expectNoA11yViolations(page)
      await composer.templatePickerInput.fill('welc')
      await expect(composer.templatePickerResults).toHaveText(
        '1 template found'
      )

      await composer.templatePickerOptions.click()

      await expect(composer.templatePicker).toBeHidden()
      await expect(composer.subjectInput).toHaveValue('Welcome aboard')
      await expect(composer.editor).toContainText('Glad to have you with us')
    }
  )

  test('CMP-98 a template found by a search opens in the composer, not in the reading view', async ({
    page,
    user,
    jmap
  }) => {
    await seedTemplates(jmap, await ownTemplatesFolder(jmap), {
      'Zebra quarterly template': 'Quarterly numbers'
    })
    const mailbox = await new LoginPage(page).loginAs(user)
    const search = new SearchPage(page)
    await search.search('Zebra')
    await search.expectResults()

    await search.resultRow('Zebra quarterly template').click()

    const composer = new ComposerPage(page)
    await expect(composer.subjectInput).toHaveValue('Zebra quarterly template')
    await expect(composer.editor).toContainText('Quarterly numbers')
    expect(page.url()).not.toContain('/email/')
    await expect(mailbox.page.getByTestId('search-results')).toBeVisible()
  })

  test('CMP-99 inserting a template saved with a signature keeps the signature of the identity, once', async ({
    page,
    user,
    jmap
  }) => {
    // The identity has a signature; the template was written with it
    const accountId = await jmap.accountId()
    const [identities] = await jmap.request([
      ['Identity/get', { accountId, ids: null }, 'i']
    ])
    const identityId = (identities?.[1].list as { id: string }[])[0]?.id ?? ''
    await jmap.request([
      [
        'Identity/set',
        {
          accountId,
          update: { [identityId]: { htmlSignature: '<p>Alice from sales</p>' } }
        },
        's'
      ]
    ])
    const mailbox = await new LoginPage(page).loginAs(user)
    const author = await mailbox.compose()
    await author.fill({ subject: 'Signed template', body: 'Template text' })
    await expect(author.editor.getByText('Alice from sales')).toBeVisible()
    await saveAsTemplate(author, mailbox, 'saved')
    await author.close()
    await expect(author.root).toBeHidden()

    const composer = await mailbox.compose()
    const signatures = composer.editor.locator(
      '[data-html-block-view="signature"]'
    )
    await composer.fill({ subject: 'Mine', body: 'My own text' })
    await expect(signatures).toHaveCount(1)
    const dialog = page.getByTestId('confirm-dialog')

    // At the cursor: the template body comes in, its signature does not
    await composer.openTemplatePicker()
    await composer.templatePickerOptions
      .filter({ hasText: 'Signed template' })
      .click()
    await dialog.getByTestId('confirm-dialog-confirm-button').click()
    await expect(composer.editor).toContainText('Template text')
    await expect(composer.editor).toContainText('My own text')
    await expect(signatures).toHaveCount(1)
    await expect(composer.editor.getByText('Alice from sales')).toHaveCount(1)

    // Replacing the message: the identity signature stays, once
    await composer.openTemplatePicker()
    await composer.templatePickerOptions
      .filter({ hasText: 'Signed template' })
      .click()
    await dialog.getByTestId('confirm-dialog-alternative-button').click()
    await expect(composer.editor).not.toContainText('My own text')
    await expect(signatures).toHaveCount(1)
    await expect(composer.editor.getByText('Alice from sales')).toHaveCount(1)
  })
})
