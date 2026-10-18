import { normalizeMailbox } from '@common/features/mailbox/queries'
import { makeMailbox } from '@common/testing/fakeJmapServer'

import type { ThreadMember } from './queries'
import {
  getFolderSides,
  getTeamMailboxIds,
  isReceivedFromOthers,
  onSide,
  summarizeThread,
  withoutSentAndDrafts,
  withoutTeamCopies,
  type FolderSides,
  type ThreadContext
} from './threadSummary'

const ME = 'alice@example.com'
const TEAM_SENT = 'team-sent'
const TEAM_MAILBOX_IDS: ReadonlySet<string> = new Set([TEAM_SENT])
const SIDES: FolderSides = {
  sideOf: new Map([
    ['trash', 'trash'],
    ['trash-old', 'trash'],
    ['spam', 'spam'],
    ['drafts', 'drafts']
  ]),
  keptElsewhere: new Set(['drafts'])
}

function context(rowEmailId = 'm1'): ThreadContext {
  return {
    ownAddress: ME,
    meLabel: 'Me',
    sentId: 'sent',
    teamMailboxIds: TEAM_MAILBOX_IDS,
    sides: SIDES,
    rowEmailId
  }
}

function member(
  id: string,
  from: { name?: string; email: string },
  overrides: Partial<ThreadMember> = {}
): ThreadMember {
  return {
    id,
    threadId: 't',
    mailboxIds: { inbox: true },
    keywords: { $seen: true },
    receivedAt: `2026-10-0${id.slice(-1)}T08:00:00Z`,
    from: [{ name: from.name ?? null, email: from.email }],
    to: [{ name: null, email: 'dan@example.com' }],
    hasAttachment: false,
    ...overrides
  }
}

describe('isReceivedFromOthers', () => {
  const BOB = { email: 'bob@example.com' }
  const isReceived = (email: ThreadMember): boolean =>
    isReceivedFromOthers(email, 'sent', ME)

  it('is true for an email someone else sent to the user', () => {
    expect(isReceived(member('m1', BOB))).toBe(true)
  })

  it('is false for an email in Sent, from the user or a draft', () => {
    const emails = [
      member('m1', BOB, { mailboxIds: { sent: true } }),
      member('m2', { email: 'Alice@Example.com' }),
      member('m3', BOB, { keywords: { $draft: true } })
    ]

    expect(emails.map(isReceived)).toEqual([false, false, false])
  })
})

describe('summarizeThread', () => {
  it('names each participant once, in order, the user as "me"', () => {
    const summary = summarizeThread(
      [
        member('m1', { name: 'Bob Dupont', email: 'bob@example.com' }),
        member('m2', { email: 'ALICE@example.com' }),
        member('m3', { name: 'Bob Dupont', email: 'bob@example.com' }),
        member('m4', { email: 'carol@example.com' })
      ],
      context()
    )

    expect(summary.participants).toEqual([
      'Bob Dupont',
      'Me',
      'carol@example.com'
    ])
    expect(summary.count).toBe(4)
  })

  it('takes the state of any of its emails', () => {
    const summary = summarizeThread(
      [
        member('m1', { email: 'bob@example.com' }, { hasAttachment: true }),
        member(
          'm2',
          { email: 'bob@example.com' },
          { keywords: { $flagged: true } }
        )
      ],
      context()
    )

    expect(summary).toMatchObject({
      isUnread: true,
      isStarred: true,
      hasAttachment: true
    })
  })

  it('is read and not starred when none of its emails is', () => {
    const summary = summarizeThread(
      [member('m1', { email: 'bob@example.com' })],
      context()
    )

    expect(summary).toMatchObject({
      isUnread: false,
      isStarred: false,
      hasAttachment: false
    })
  })

  it('does not count the copy in Sent of an email sent to oneself', () => {
    const toMe = { to: [{ name: null, email: ME }] }
    const members = [
      member('m1', { email: 'bob@example.com' }),
      member('m2', { email: ME }, { ...toMe, mailboxIds: { inbox: true } }),
      member('m3', { email: ME }, { ...toMe, mailboxIds: { sent: true } })
    ]

    expect(summarizeThread(members, context('m1')).count).toBe(2)
    expect(summarizeThread(members.slice(1), context('m2')).count).toBe(1)
    // Opened from Sent, the copy is the row: counted
    expect(summarizeThread(members, context('m3')).count).toBe(3)
    expect(summarizeThread(members, context('m1')).members).toHaveLength(3)
  })

  it('counts and targets once a mail a team mailbox sent the user', () => {
    const team = { email: 'team@example.com' }
    const members = [
      member('m1', team, { mailboxIds: { [TEAM_SENT]: true } }),
      member('m2', team, { mailboxIds: { inbox: true } })
    ].map(copy => ({ ...copy, messageId: ['same@example.com'] }))

    const summary = summarizeThread(members, context('m2'))

    expect(summary.count).toBe(1)
    expect(summary.members.map(copy => copy.id)).toEqual(['m2'])
  })
})

describe('withoutTeamCopies', () => {
  const team = { email: 'team@example.com' }
  const teamCopy = member('m1', team, {
    mailboxIds: { [TEAM_SENT]: true },
    messageId: ['same@example.com']
  })
  const ownCopy = member('m2', team, {
    mailboxIds: { inbox: true },
    messageId: ['same@example.com']
  })
  const reply = member(
    'm3',
    { email: ME },
    { mailboxIds: { [TEAM_SENT]: true }, messageId: ['other@example.com'] }
  )

  it('hides the team copy of a mail opened from the user folders', () => {
    expect(
      withoutTeamCopies([teamCopy, ownCopy, reply], 'm2', TEAM_MAILBOX_IDS)
    ).toEqual([ownCopy, reply])
  })

  it('hides the user copy of a mail opened from the team mailbox', () => {
    expect(
      withoutTeamCopies([teamCopy, ownCopy, reply], 'm1', TEAM_MAILBOX_IDS)
    ).toEqual([teamCopy, reply])
  })

  it('keeps the copies when the folders are not known yet', () => {
    expect(withoutTeamCopies([teamCopy, ownCopy], 'm2', new Set())).toEqual([
      teamCopy,
      ownCopy
    ])
  })

  it('keeps the emails without a Message-ID', () => {
    const copies = [
      { ...teamCopy, messageId: null },
      { ...ownCopy, messageId: null }
    ]

    expect(withoutTeamCopies(copies, 'm2', TEAM_MAILBOX_IDS)).toEqual(copies)
  })
})

describe('getTeamMailboxIds', () => {
  it('lists the folders of another namespace', () => {
    expect(
      getTeamMailboxIds([
        { id: 'inbox', namespace: 'Personal' },
        { id: 'archive', namespace: null },
        { id: TEAM_SENT, namespace: 'TeamMailbox[team@example.com]' }
      ])
    ).toEqual(new Set([TEAM_SENT]))
  })
})

describe('onSide', () => {
  const BOB = { email: 'bob@example.com' }
  const deleted = member('m1', BOB, { mailboxIds: { trash: true } })
  const reply = member('m2', BOB)
  const draft = member('m3', { email: ME }, { mailboxIds: { drafts: true } })
  const spam = member('m4', BOB, { mailboxIds: { spam: true } })
  const filed = member('m5', BOB, { mailboxIds: { 'trash-old': true } })
  const emails = [deleted, reply, draft, spam, filed]
  const ids = (side: string | null): string[] =>
    onSide(emails, side, SIDES).map(email => email.id)

  it('leaves the emails of Trash and Spam out of a conversation shown elsewhere, not its drafts', () => {
    expect(ids(null)).toEqual(['m2', 'm3'])
  })

  it('keeps only the emails of Trash, its subfolders included, shown from Trash', () => {
    expect(ids('trash')).toEqual(['m1', 'm5'])
  })

  it('keeps only the emails of Spam shown from Spam', () => {
    expect(ids('spam')).toEqual(['m4'])
  })

  it('keeps only the drafts shown from Drafts', () => {
    expect(ids('drafts')).toEqual(['m3'])
  })

  it('leaves them out of the members a conversation row acts on', () => {
    expect(
      summarizeThread([deleted, reply], context('m2')).members.map(
        email => email.id
      )
    ).toEqual(['m2'])
  })
})

describe('getFolderSides', () => {
  it('puts each folder on the side of the folder deleting forever it is in', () => {
    const team = 'TeamMailbox[team@example.com]'
    const sides = getFolderSides(
      [
        makeMailbox({ id: 'trash', name: 'Trash', role: 'trash' }),
        makeMailbox({ id: 'trash-old', name: 'Old', parentId: 'trash' }),
        makeMailbox({ id: 'inbox', name: 'INBOX', role: 'inbox' }),
        makeMailbox({ id: 'spam', name: 'Spam', role: 'junk' }),
        makeMailbox({ id: 'drafts', name: 'Drafts', role: 'drafts' }),
        makeMailbox({ id: 'team', name: 'team', namespace: team }),
        makeMailbox({
          id: 'team-trash',
          name: 'Trash',
          namespace: team,
          parentId: 'team'
        })
      ].map(normalizeMailbox)
    )

    expect(Object.fromEntries(sides.sideOf)).toEqual({
      trash: 'trash',
      'trash-old': 'trash',
      spam: 'spam',
      drafts: 'drafts',
      'team-trash': 'team-trash'
    })
    expect(sides.keptElsewhere).toEqual(new Set(['drafts']))
  })
})

describe('withoutSentAndDrafts', () => {
  const team = 'TeamMailbox[team@example.com]'
  const mailboxes = [
    makeMailbox({ id: 'inbox', name: 'INBOX', role: 'inbox' }),
    makeMailbox({ id: 'sent', name: 'Sent', role: 'sent' }),
    makeMailbox({ id: 'drafts', name: 'Drafts', role: 'drafts' }),
    makeMailbox({ id: 'team', name: 'team', namespace: team }),
    makeMailbox({
      id: 'team-sent',
      name: 'Sent',
      namespace: team,
      parentId: 'team'
    })
  ].map(normalizeMailbox)
  const email = (id: string, mailboxId: string): ThreadMember =>
    member(id, { email: ME }, { mailboxIds: { [mailboxId]: true } })

  it('leaves out the emails in Sent and Drafts, of the user and of team mailboxes', () => {
    const emails = [
      email('received', 'inbox'),
      email('sent', 'sent'),
      email('draft', 'drafts'),
      email('team-sent', 'team-sent')
    ]

    expect(
      withoutSentAndDrafts(emails, 'received', mailboxes).map(({ id }) => id)
    ).toEqual(['received'])
  })

  it('keeps the email opened, wherever it is', () => {
    const emails = [email('received', 'inbox'), email('sent', 'sent')]

    expect(
      withoutSentAndDrafts(emails, 'sent', mailboxes).map(({ id }) => id)
    ).toEqual(['received', 'sent'])
  })
})
