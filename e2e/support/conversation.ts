import type { Email, JmapClient } from './jmap'

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
 * A reply in the thread of `original`, filed in the Inbox the way a server
 * would: same thread (`In-Reply-To`, `References`), "Re: " subject, received
 * now. Returns its id.
 */
export async function addReplyInInbox(
  jmap: JmapClient,
  original: Email,
  input: { from: string; to: string; text: string }
): Promise<string> {
  const accountId = await jmap.accountId()
  const inbox = await jmap.findMailboxByRole('inbox')
  const messageId = await messageIdOf(jmap, original.id)
  const responses = await jmap.request([
    [
      'Email/set',
      {
        accountId,
        create: {
          reply: {
            mailboxIds: { [inbox.id]: true },
            keywords: { $seen: true },
            from: [{ email: input.from }],
            to: [{ email: input.to }],
            subject: `Re: ${original.subject ?? ''}`,
            receivedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            'header:In-Reply-To:asMessageIds': [messageId],
            'header:References:asMessageIds': [messageId],
            textBody: [{ partId: 'text', type: 'text/plain' }],
            bodyValues: { text: { value: input.text } }
          }
        }
      },
      'reply'
    ]
  ])
  const created = responses[0]?.[1].created
  const reply: unknown =
    typeof created === 'object' && created !== null && 'reply' in created
      ? created.reply
      : null
  if (
    typeof reply !== 'object' ||
    reply === null ||
    !('id' in reply) ||
    typeof reply.id !== 'string'
  ) {
    throw new Error('The reply was not created')
  }
  return reply.id
}
