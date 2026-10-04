import { QueryClient } from '@tanstack/react-query'

import { emailKeys, type EmailDetail } from '@common/features/email/queries'
import { patchMailboxes } from '@common/features/mailbox/patchMailboxes'
import {
  mailboxKeys,
  type MailboxListData
} from '@common/features/mailbox/queries'
import { patchEmailList } from '@common/features/thread/patchEmailList'
import {
  threadKeys,
  type EmailListData,
  type EmailListItemData
} from '@common/features/thread/queries'
import { makeEmail, makeMailbox } from '@common/testing/fakeJmapServer'

import {
  applyEmailChanges,
  findCachedEmail,
  findListRows
} from './optimisticEmailChanges'
import { planEmailChanges } from './planEmailChanges'

const ACCOUNT = 'account'
const INBOX = 'inbox'
const ARCHIVE = 'archive'

function email(
  id: string,
  day: number,
  overrides: Partial<EmailListItemData> = {}
): EmailListItemData {
  return makeEmail({
    id,
    mailboxIds: { [INBOX]: true },
    receivedAt: `2026-10-${String(day).padStart(2, '0')}T08:00:00Z`,
    ...overrides
  })
}

function list(emails: EmailListItemData[]): EmailListData {
  return {
    pages: [
      {
        emails,
        position: 0,
        count: emails.length,
        total: emails.length,
        isLast: true,
        state: 's1'
      }
    ],
    pageParams: [0]
  }
}

function setUp(): QueryClient {
  const queryClient = new QueryClient()
  queryClient.setQueryData(
    threadKeys.list(ACCOUNT, INBOX),
    list([email('a', 20), email('b', 18, { keywords: { $seen: true } })])
  )
  queryClient.setQueryData(
    threadKeys.list(ACCOUNT, ARCHIVE),
    list([email('old', 10, { mailboxIds: { [ARCHIVE]: true } })])
  )
  queryClient.setQueryData<MailboxListData>(mailboxKeys.list(ACCOUNT), {
    state: 'm1',
    list: [
      makeMailbox({
        id: INBOX,
        name: 'Inbox',
        totalEmails: 2,
        unreadEmails: 1
      }),
      makeMailbox({ id: ARCHIVE, name: 'Archive', totalEmails: 1 })
    ]
  })
  return queryClient
}

function ids(queryClient: QueryClient, mailboxId: string): string[] {
  return (
    queryClient
      .getQueryData<EmailListData>(threadKeys.list(ACCOUNT, mailboxId))
      ?.pages.flatMap(page => page.emails.map(item => item.id)) ?? []
  )
}

function counters(queryClient: QueryClient): Record<string, string> {
  return Object.fromEntries(
    (
      queryClient.getQueryData<MailboxListData>(mailboxKeys.list(ACCOUNT))
        ?.list ?? []
    ).map(mailbox => [
      mailbox.id,
      `${mailbox.totalEmails}/${mailbox.unreadEmails}`
    ])
  )
}

function archive(queryClient: QueryClient, emailId: string): void {
  const rows = findListRows(queryClient, ACCOUNT, [emailId])
  const target = findCachedEmail(queryClient, ACCOUNT, emailId)
  if (target === null) throw new Error(`No ${emailId} in the cache`)
  applyEmailChanges(
    queryClient,
    ACCOUNT,
    planEmailChanges([target], { kind: 'move', from: INBOX, to: ARCHIVE }),
    rows
  )
}

describe('applyEmailChanges', () => {
  it('moves the email between the lists and the counters at once', () => {
    const queryClient = setUp()

    archive(queryClient, 'a')

    expect(ids(queryClient, INBOX)).toEqual(['b'])
    expect(ids(queryClient, ARCHIVE)).toEqual(['a', 'old'])
    expect(counters(queryClient)).toEqual({ inbox: '1/0', archive: '2/1' })
  })

  it('changes nothing more when the push of the same change comes back', () => {
    const queryClient = setUp()
    archive(queryClient, 'a')
    const archived = email('a', 20, { mailboxIds: { [ARCHIVE]: true } })

    // What push applies: the email as the server has it, and the server
    // counters, at a new state
    for (const mailboxId of [INBOX, ARCHIVE]) {
      queryClient.setQueryData<EmailListData>(
        threadKeys.list(ACCOUNT, mailboxId),
        data =>
          data &&
          patchEmailList(data, mailboxId, {
            changed: [archived],
            destroyed: [],
            newStates: new Map([['s1', 's2']])
          })
      )
    }
    queryClient.setQueryData<MailboxListData>(
      mailboxKeys.list(ACCOUNT),
      data =>
        data &&
        patchMailboxes(data, {
          changed: [
            makeMailbox({ id: INBOX, name: 'Inbox', totalEmails: 1 }),
            makeMailbox({
              id: ARCHIVE,
              name: 'Archive',
              totalEmails: 2,
              unreadEmails: 1
            })
          ],
          destroyed: [],
          oldState: 'm1',
          newState: 'm2'
        })
    )

    expect(ids(queryClient, INBOX)).toEqual(['b'])
    expect(ids(queryClient, ARCHIVE)).toEqual(['a', 'old'])
    expect(
      queryClient.getQueryData<EmailListData>(threadKeys.list(ACCOUNT, ARCHIVE))
        ?.pages[0]?.count
    ).toBe(2)
    expect(counters(queryClient)).toEqual({ inbox: '1/0', archive: '2/1' })
  })

  it('updates the opened email, and drops it once destroyed', () => {
    const queryClient = setUp()
    const detailKey = emailKeys.detail(ACCOUNT, 'b')
    queryClient.setQueryData(detailKey, {
      ...email('b', 18, { keywords: { $seen: true } })
    })
    const target = findCachedEmail(queryClient, ACCOUNT, 'b')
    if (target === null) throw new Error('No b')

    applyEmailChanges(
      queryClient,
      ACCOUNT,
      planEmailChanges([target], {
        kind: 'keyword',
        keyword: '$flagged',
        isSet: true
      }),
      findListRows(queryClient, ACCOUNT, ['b'])
    )
    expect(queryClient.getQueryData<EmailDetail>(detailKey)?.keywords).toEqual({
      $seen: true,
      $flagged: true
    })

    applyEmailChanges(
      queryClient,
      ACCOUNT,
      planEmailChanges([target], { kind: 'destroy' }),
      new Map()
    )

    expect(queryClient.getQueryData(detailKey)).toBe(null)
    expect(ids(queryClient, INBOX)).toEqual(['a'])
    expect(counters(queryClient)).toEqual({ inbox: '1/1', archive: '1/0' })
  })

  it('takes an email out of the lists even without its row', () => {
    const queryClient = setUp()

    applyEmailChanges(
      queryClient,
      ACCOUNT,
      planEmailChanges([email('a', 20)], {
        kind: 'move',
        from: INBOX,
        to: ARCHIVE
      }),
      new Map()
    )

    expect(ids(queryClient, INBOX)).toEqual(['b'])
    expect(ids(queryClient, ARCHIVE)).toEqual(['old'])
  })
})
