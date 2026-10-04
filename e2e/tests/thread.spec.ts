import { ConversationPage, LoginPage, SearchPage } from '../pages'
import { expectNoA11yViolations } from '../support/a11y'
import { expect, test } from '../support/fixtures'
import type { Email, JmapClient } from '../support/jmap'

const SUBJECT = 'Reply thread'

/** The first email of the thread, received at its date: the replies follow */
async function importOriginal(jmap: JmapClient): Promise<Email> {
  return jmap.importEml('reply_email/reply-thread.eml', 'inbox', {
    keywords: { $seen: true },
    receivedAt: '2024-12-17T16:31:00Z'
  })
}

/** The Message-ID of an email, to reply to it */
async function messageIdOf(jmap: JmapClient, emailId: string): Promise<string> {
  const accountId = await jmap.accountId()
  const responses = await jmap.request([
    ['Email/get', { accountId, ids: [emailId], properties: ['messageId'] }, 'g']
  ])
  const list = responses[0]?.[1].list
  const first: unknown = Array.isArray(list) ? list[0] : undefined
  const messageId =
    typeof first === 'object' && first !== null && 'messageId' in first
      ? first.messageId
      : null
  if (!Array.isArray(messageId) || typeof messageId[0] !== 'string') {
    throw new Error(`No Message-ID for ${emailId}`)
  }
  return messageId[0]
}

/**
 * A reply in the thread of `original`, created in a mailbox as a client
 * would file it (the composer comes with phase 3): same subject, the
 * `In-Reply-To` and `References` of the original
 */
async function addReply(
  jmap: JmapClient,
  original: Email,
  options: {
    from: string
    to: string
    text: string
    mailbox: 'inbox' | 'sent'
    seen: boolean
    /** Now by default */
    receivedAt?: string
  }
): Promise<void> {
  const accountId = await jmap.accountId()
  const mailbox = await jmap.findMailboxByRole(options.mailbox)
  const messageId = await messageIdOf(jmap, original.id)
  await jmap.request([
    [
      'Email/set',
      {
        accountId,
        create: {
          reply: {
            mailboxIds: { [mailbox.id]: true },
            keywords: options.seen ? { $seen: true } : {},
            from: [{ email: options.from }],
            to: [{ email: options.to }],
            subject: `Re: ${original.subject ?? ''}`,
            receivedAt:
              options.receivedAt ??
              new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            'header:In-Reply-To:asMessageIds': [messageId],
            'header:References:asMessageIds': [messageId],
            textBody: [{ partId: 'text', type: 'text/plain' }],
            bodyValues: { text: { value: options.text } }
          }
        }
      },
      'reply'
    ]
  ])
}

test.describe('THR thread detail', () => {
  test('THR-01 a reply sent while the conversation is open joins it, collapsed', async ({
    page,
    user,
    jmap
  }) => {
    const original = await importOriginal(jmap)
    // Conversations are on by default
    const mailbox = await new LoginPage(page).loginAs(user)

    const search = await new SearchPage(page).search(SUBJECT)
    await search.resultRow(SUBJECT).click()
    const conversation = await new ConversationPage(page).expectLoaded(SUBJECT)
    await expect(conversation.messages).toHaveCount(1)
    await expectNoA11yViolations(page)

    // TODO: reply from the composer once it exists (phase 3)
    await addReply(jmap, original, {
      from: user.email,
      to: 'emma@example.com',
      text: 'reply thread detail',
      mailbox: 'sent',
      seen: true
    })

    const reply = conversation.message(/reply thread detail/)
    await expect(reply).toBeVisible()
    await expect(conversation.toggle(reply)).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    await expect(conversation.messages).toHaveCount(2)
    await expect(conversation.count).toHaveText('2 messages')
    await expect(
      page.getByTestId('conversation-announcement')
    ).toHaveText(/New message from/)
  })

  test('THR-02 a conversation is one row with its message count, unread and last messages expanded', async ({
    page,
    user,
    jmap
  }) => {
    const original = await importOriginal(jmap)
    await addReply(jmap, original, {
      from: 'emma@example.com',
      to: user.email,
      text: 'second message of the thread',
      mailbox: 'inbox',
      seen: true,
      receivedAt: '2024-12-18T10:00:00Z'
    })
    await addReply(jmap, original, {
      from: 'emma@example.com',
      to: user.email,
      text: 'third message, unread',
      mailbox: 'inbox',
      seen: false,
      receivedAt: '2024-12-18T11:00:00Z'
    })

    // Conversations are on by default
    const mailbox = await new LoginPage(page).loginAs(user)
    const row = mailbox.emailRow(`Re: ${SUBJECT}`)
    await expect(row).toHaveCount(1)
    await expect(mailbox.emailRow(SUBJECT)).toHaveCount(0)
    await expect(mailbox.emailRowThreadCount(`Re: ${SUBJECT}`)).toHaveText(/^\(3\)/)
    await expectNoA11yViolations(page)

    // A finger on touch screens: a mouse left over the toolbar of the
    // conversation would show its tooltip once the view transition ends
    if (test.info().project.use.hasTouch === true) await row.tap()
    else await row.click()
    const conversation = await new ConversationPage(page).expectLoaded(
      `Re: ${SUBJECT}`
    )
    await expect(conversation.messages).toHaveCount(3)
    const [first, second, third] = [
      conversation.messages.nth(0),
      conversation.messages.nth(1),
      conversation.messages.nth(2)
    ]
    await expect(conversation.toggle(first)).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    await expect(conversation.toggle(second)).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    await expect(conversation.toggle(third)).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    await expect(conversation.body(third).locator('body')).toContainText(
      'third message, unread'
    )
    await expect
      .poll(
        async () => (await jmap.queryEmails({ notKeyword: '$seen' })).length
      )
      .toBe(0)
    await expectNoA11yViolations(page)

    // The keyboard moves between the messages, Enter expands one
    await conversation.toggle(first).focus()
    await page.keyboard.press('ArrowDown')
    await expect(conversation.toggle(second)).toBeFocused()
    await page.keyboard.press('End')
    await expect(conversation.toggle(third)).toBeFocused()
    await page.keyboard.press('Home')
    await expect(conversation.toggle(first)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(conversation.toggle(first)).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    await expect(conversation.body(first).locator('body')).toContainText(
      'Reply thread'
    )

    await conversation.backButton.click()
    await expect(mailbox.emailList).toBeVisible()
  })

  test('THR-03 the conversation actions mark every message read or starred', async ({
    page,
    user,
    jmap
  }) => {
    const original = await importOriginal(jmap)
    await addReply(jmap, original, {
      from: 'emma@example.com',
      to: user.email,
      text: 'second message',
      mailbox: 'inbox',
      seen: true,
      receivedAt: '2024-12-18T10:00:00Z'
    })
    // Conversations are on by default
    const mailbox = await new LoginPage(page).loginAs(user)
    await mailbox.emailRow(`Re: ${SUBJECT}`).click()
    const conversation = await new ConversationPage(page).expectLoaded(
      `Re: ${SUBJECT}`
    )

    await conversation.toggleStarButton.click()
    await expect(conversation.toggleStarButton).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expect
      .poll(
        async () => (await jmap.queryEmails({ hasKeyword: '$flagged' })).length
      )
      .toBe(2)

    await conversation.toggleSeenButton.click()
    await expect
      .poll(
        async () => (await jmap.queryEmails({ notKeyword: '$seen' })).length
      )
      .toBe(2)
  })
})
