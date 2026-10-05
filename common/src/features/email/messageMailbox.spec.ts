import { messageMailboxId } from './messageMailbox'

const MAILBOXES = [{ id: 'inbox' }, { id: 'sent' }, { id: 'trash' }]

describe('messageMailboxId', () => {
  it('keeps the open folder when the message is in it', () => {
    expect(
      messageMailboxId(
        { mailboxIds: { sent: true, inbox: true } },
        'inbox',
        MAILBOXES
      )
    ).toBe('inbox')
  })

  it('takes the folder of the message when it is elsewhere', () => {
    expect(
      messageMailboxId({ mailboxIds: { trash: true } }, 'inbox', MAILBOXES)
    ).toBe('trash')
  })

  it('takes the folder of the message from search results', () => {
    expect(
      messageMailboxId({ mailboxIds: { sent: true } }, null, MAILBOXES)
    ).toBe('sent')
  })

  it('skips the folders the tree does not know', () => {
    expect(
      messageMailboxId(
        { mailboxIds: { unknown: true, sent: true } },
        null,
        MAILBOXES
      )
    ).toBe('sent')
    expect(
      messageMailboxId({ mailboxIds: { unknown: true } }, null, MAILBOXES)
    ).toBe(null)
  })
})
