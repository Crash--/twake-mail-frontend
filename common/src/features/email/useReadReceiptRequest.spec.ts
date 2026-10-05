import { READ_RECEIPT_HEADER } from './queries'
import { asksReadReceipt, MDN_SENT } from './useReadReceiptRequest'

function email(
  keywords: Record<string, true>,
  mailboxIds: Record<string, true> = { inbox: true }
): Parameters<typeof asksReadReceipt>[0] {
  return { keywords, mailboxIds, [READ_RECEIPT_HEADER]: 'bob@example.com' }
}

describe('asksReadReceipt', () => {
  it('asks for an email received with a Disposition-Notification-To', () => {
    expect(asksReadReceipt(email({ $seen: true }), 'sent')).toBe(true)
  })

  it.each([
    ['sent already', email({ [MDN_SENT]: true })],
    ['in Sent', email({}, { sent: true })],
    ['a draft of the user', email({ $draft: true }, { drafts: true })]
  ])('does not ask for an email %s', (_, candidate) => {
    expect(asksReadReceipt(candidate, 'sent')).toBe(false)
  })
})
