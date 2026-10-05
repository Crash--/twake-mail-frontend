import { filterVerdict, type FilteredEmail } from './filterVerdict'

const INBOX_EMAIL: FilteredEmail = {
  mailboxIds: { inbox: true },
  keywords: { $seen: true },
  receivedAt: '2026-10-05T08:00:00Z',
  hasAttachment: false
}

describe('filterVerdict', () => {
  it('reads the folders, keywords, attachment and dates of the email', () => {
    expect(filterVerdict({ inMailbox: 'inbox' }, INBOX_EMAIL)).toBe('yes')
    expect(filterVerdict({ inMailbox: 'trash' }, INBOX_EMAIL)).toBe('no')
    expect(
      filterVerdict({ inMailboxOtherThan: ['trash', 'spam'] }, INBOX_EMAIL)
    ).toBe('yes')
    expect(
      filterVerdict(
        { inMailboxOtherThan: ['trash', 'spam'] },
        { ...INBOX_EMAIL, mailboxIds: { trash: true } }
      )
    ).toBe('no')
    expect(filterVerdict({ hasKeyword: '$Flagged' }, INBOX_EMAIL)).toBe('no')
    expect(filterVerdict({ notKeyword: '$seen' }, INBOX_EMAIL)).toBe('no')
    expect(filterVerdict({ hasAttachment: true }, INBOX_EMAIL)).toBe('no')
    expect(filterVerdict({ after: '2026-10-01T00:00:00Z' }, INBOX_EMAIL)).toBe(
      'yes'
    )
    expect(filterVerdict({ before: '2026-10-01T00:00:00Z' }, INBOX_EMAIL)).toBe(
      'no'
    )
  })

  it('leaves to the server the words, addresses and bounds it cannot tell', () => {
    expect(filterVerdict({ text: 'invoice' }, INBOX_EMAIL)).toBe('maybe')
    expect(filterVerdict({ from: 'bob' }, INBOX_EMAIL)).toBe('maybe')
    expect(filterVerdict({ after: '2026-10-05T08:00:00Z' }, INBOX_EMAIL)).toBe(
      'maybe'
    )
    expect(
      filterVerdict(
        { after: '2026-10-01T00:00:00Z' },
        { mailboxIds: { inbox: true }, keywords: {} }
      )
    ).toBe('maybe')
  })

  it('fails a condition on one of its properties', () => {
    expect(
      filterVerdict(
        { text: 'invoice', inMailboxOtherThan: ['trash'] },
        { ...INBOX_EMAIL, mailboxIds: { trash: true } }
      )
    ).toBe('no')
    expect(
      filterVerdict(
        { text: 'invoice', inMailboxOtherThan: ['trash'] },
        INBOX_EMAIL
      )
    ).toBe('maybe')
  })

  it('combines AND, OR and NOT in three values', () => {
    const trash = { inMailbox: 'trash' }
    const words = { text: 'invoice' }
    const inbox = { inMailbox: 'inbox' }
    expect(
      filterVerdict(
        { operator: 'AND', conditions: [words, trash] },
        INBOX_EMAIL
      )
    ).toBe('no')
    expect(
      filterVerdict({ operator: 'OR', conditions: [words, trash] }, INBOX_EMAIL)
    ).toBe('maybe')
    expect(
      filterVerdict({ operator: 'OR', conditions: [words, inbox] }, INBOX_EMAIL)
    ).toBe('yes')
    expect(
      filterVerdict({ operator: 'NOT', conditions: [trash] }, INBOX_EMAIL)
    ).toBe('yes')
    expect(
      filterVerdict({ operator: 'NOT', conditions: [words] }, INBOX_EMAIL)
    ).toBe('maybe')
    expect(filterVerdict(null, INBOX_EMAIL)).toBe('yes')
  })
})
