import path from 'node:path'

import { env } from '../support/env'
import { expect, test } from '../support/fixtures'
import { JmapClient } from '../support/jmap'

/**
 * Smoke tests of the harness itself, without any UI: if one of these fails, every UI spec
 * would fail for a reason that has nothing to do with the app. Not part of e2e.md.
 */
test.describe('INFRA harness', () => {
  test('INFRA-01 a new user gets a JMAP session and the default mailboxes', async ({
    user,
    jmap
  }) => {
    const session = await jmap.getSession()
    expect(session.username).toBe(user.email)

    const roles = (await jmap.getMailboxes()).map(mailbox => mailbox.role)
    expect(roles).toEqual(
      expect.arrayContaining([
        'inbox',
        'drafts',
        'sent',
        'trash',
        'junk',
        'archive'
      ])
    )
  })

  test('INFRA-02 every test gets its own account, removed after the test', async ({
    user,
    users
  }) => {
    const other = await users.create({ prefix: 'other' })
    expect(other.email).not.toBe(user.email)
    expect(other.email).toMatch(
      new RegExp(`^other-[0-9a-f-]{36}@${env.domain}$`)
    )

    expect(await users.cleanup()).toEqual([])
    await expect(JmapClient.forUser(other).getSession()).rejects.toThrow(/401/)
  })

  test('INFRA-03 an email sent by one user is received by another', async ({
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const recipient = await users.create({ prefix: 'recipient' })
    const subject = `Hello ${recipient.localPart}`

    await jmap.sendEmail({
      to: [{ name: 'Recipient', email: recipient.email }],
      subject,
      text: 'Plain text body',
      html: '<p>HTML <b>body</b></p>',
      attachments: [
        {
          path: path.join(__dirname, '..', 'fixtures', 'files', 'hello.txt'),
          type: 'text/plain'
        }
      ]
    })

    const received = await jmapFor(recipient).waitForEmail({ subject })
    expect(received.from?.[0]?.email).toBe(user.email)
    expect(received.to?.[0]?.email).toBe(recipient.email)
    expect(received.hasAttachment).toBe(true)
    expect(received.keywords.$seen).toBeUndefined()

    const sent = await jmap.waitForEmail({ subject, mailboxRole: 'sent' })
    expect(sent.keywords.$draft).toBeUndefined()
  })

  test('INFRA-04 an email can be seeded in any folder by sending it to oneself', async ({
    user,
    jmap
  }) => {
    await jmap.sendEmail({
      to: user.email,
      subject: 'Lands in trash',
      text: 'x',
      saveTo: 'trash'
    })

    await jmap.waitForEmail({ subject: 'Lands in trash', mailboxRole: 'trash' })
    await jmap.waitForEmail({ subject: 'Lands in trash', mailboxRole: 'inbox' })
  })

  test('INFRA-05 an .eml fixture is imported, and its keywords can be changed', async ({
    jmap
  }) => {
    const imported = await jmap.importEml(
      'reply_email/reply-all.eml',
      'archive'
    )
    expect(imported.subject).toBe('Reply all email')
    expect(imported.keywords).toEqual({})

    const found = await jmap.waitForEmail({
      subject: 'Reply all email',
      mailboxRole: 'archive'
    })
    expect(found.id).toBe(imported.id)

    await jmap.setKeywords(imported.id, { $seen: true, $flagged: true })
    expect((await jmap.getEmail(imported.id)).keywords).toEqual({
      $seen: true,
      $flagged: true
    })

    await jmap.setKeywords(imported.id, { $flagged: false })
    expect((await jmap.getEmail(imported.id)).keywords).toEqual({ $seen: true })
  })

  test('INFRA-06 a personal folder can be created under another one', async ({
    jmap
  }) => {
    const inbox = await jmap.findMailboxByRole('inbox')
    const child = await jmap.createMailbox({
      name: 'Projects',
      parentId: inbox.id
    })

    expect(child.parentId).toBe(inbox.id)
    expect(
      (await jmap.findMailboxByName('Projects', { parentId: inbox.id })).id
    ).toBe(child.id)
  })

  test('INFRA-07 team mailboxes are shared with their members', async ({
    user,
    users,
    jmap,
    jmapFor
  }) => {
    const colleague = await users.create({ prefix: 'colleague' })
    const team = await users.createTeamMailbox({ members: [user, colleague] })

    await jmapFor(colleague).sendEmail({
      to: team.email,
      subject: 'For the whole team',
      text: 'Hi team'
    })

    const teamInbox = await jmap.findMailboxByName('INBOX', {
      namespace: `TeamMailbox[${team.email}]`
    })
    await expect
      .poll(async () =>
        (await jmap.queryEmails({ inMailbox: teamInbox.id })).map(
          email => email.subject
        )
      )
      .toContain('For the whole team')
  })

  test.describe('with a quota', () => {
    test.use({ userQuota: { count: 200, size: 50_000_000 } })

    test('INFRA-08 the quota option applies to the user', async ({ jmap }) => {
      const limits = Object.fromEntries(
        (await jmap.getQuotas()).map(quota => [
          quota.resourceType,
          quota.hardLimit
        ])
      )
      expect(limits).toEqual({ count: 200, octets: 50_000_000 })
    })
  })

  test('INFRA-09 the browser reaches JMAP on the app origin, without CORS', async ({
    page,
    user
  }) => {
    await page.goto('/')
    const username = await page.evaluate(
      async ({ email, password }) => {
        const response = await fetch('/jmap/session', {
          headers: { Authorization: `Basic ${btoa(`${email}:${password}`)}` }
        })
        const session: unknown = await response.json()
        return typeof session === 'object' &&
          session !== null &&
          'username' in session
          ? session.username
          : null
      },
      { email: user.email, password: user.password }
    )
    expect(username).toBe(user.email)
  })
})
