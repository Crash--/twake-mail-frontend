import { elapsedMs, STRESS_TIME_LIMIT_MS } from '@common/testing/redos'

import {
  canReplyAll,
  hasListPost,
  listPostRecipients,
  makeIsSelf,
  replyRecipients,
  type ReplySource
} from './replyRecipients'

const isSelf = makeIsSelf(['bob@example.com', 'Bob.Work@Example.com'])

const address = (
  email: string,
  name: string | null = null
): { name: string | null; email: string } => ({
  name,
  email
})

/** reply-all.eml of tmail-flutter, without its List-Post */
const EMMA: ReplySource = {
  from: [address('emma@example.com', 'Emma')],
  to: [address('bob@example.com')],
  cc: [address('alice@example.com')],
  bcc: [address('brian@example.com')],
  replyTo: [address('emma-reply-to@example.com')],
  listPost: null
}

const emails = (lists: { email: string }[]): string[] =>
  lists.map(recipient => recipient.email)

describe('replyRecipients', () => {
  it('replies to Reply-To, else to the sender', () => {
    expect(emails(replyRecipients(EMMA, 'reply', isSelf).to)).toEqual([
      'emma-reply-to@example.com'
    ])
    expect(
      emails(replyRecipients({ ...EMMA, replyTo: null }, 'reply', isSelf).to)
    ).toEqual(['emma@example.com'])
  })

  it('replies to the sender of a list email, and to the list on demand', () => {
    const list = {
      ...EMMA,
      listPost: ['mailto:emma-reply-to-list@example.com']
    }
    expect(emails(replyRecipients(list, 'reply', isSelf).to)).toEqual([
      'emma@example.com'
    ])
    expect(replyRecipients(list, 'replyToList', isSelf)).toEqual({
      to: [address('emma-reply-to-list@example.com')],
      cc: [],
      bcc: []
    })
  })

  it('replies to all without the user, Cc and Bcc kept', () => {
    const lists = replyRecipients(EMMA, 'replyAll', isSelf)
    expect(emails(lists.to)).toEqual(['emma-reply-to@example.com'])
    expect(emails(lists.cc)).toEqual(['alice@example.com'])
    expect(emails(lists.bcc)).toEqual(['brian@example.com'])

    const list = replyRecipients(
      { ...EMMA, listPost: ['mailto:list@example.com'] },
      'replyAll',
      isSelf
    )
    expect(emails(list.to)).toEqual([
      'emma-reply-to@example.com',
      'emma@example.com'
    ])
  })

  it('keeps the recipients of an email the user sent (ADR 0064)', () => {
    const sent: ReplySource = {
      from: [address('BOB@example.com')],
      to: [address('bob@example.com'), address('alice@example.com')],
      cc: [address('carol@example.com'), address('alice@example.com')],
      bcc: [],
      replyTo: [address('elsewhere@example.com')],
      listPost: null
    }
    expect(emails(replyRecipients(sent, 'reply', isSelf).to)).toEqual([
      'bob@example.com',
      'alice@example.com'
    ])
    const all = replyRecipients(sent, 'replyAll', isSelf)
    expect(emails(all.to)).toEqual(['alice@example.com'])
    expect(emails(all.cc)).toEqual(['carol@example.com'])
  })

  it('answers the team when a teammate sent the email as the team identity', () => {
    const isMember = makeIsSelf(['bob@example.com', 'team@example.com'])
    const fromTeammate: ReplySource = {
      from: [address('team@example.com', 'Team')],
      to: [address('bob@example.com')],
      cc: [address('carol@example.com')],
      bcc: [],
      replyTo: null,
      listPost: null
    }
    expect(emails(replyRecipients(fromTeammate, 'reply', isMember).to)).toEqual(
      ['team@example.com']
    )
    const all = replyRecipients(fromTeammate, 'replyAll', isMember)
    expect(emails(all.to)).toEqual(['team@example.com'])
    expect(emails(all.cc)).toEqual(['carol@example.com'])
    expect(canReplyAll(fromTeammate, isMember)).toBe(true)
    expect(canReplyAll({ ...fromTeammate, cc: null }, isMember)).toBe(false)
  })

  it('leaves every address of the user out, whatever its case', () => {
    const lists = replyRecipients(
      {
        ...EMMA,
        replyTo: null,
        to: [address('bob.work@example.com'), address('dan@example.com')]
      },
      'replyAll',
      isSelf
    )
    expect(emails(lists.to)).toEqual(['emma@example.com', 'dan@example.com'])
  })

  it('names a bare Reply-To address after the From, To or Cc (ADR 0065)', () => {
    const bare = {
      ...EMMA,
      to: [address('bob@example.com'), address('dan@example.com')],
      cc: [address('alice@example.com', 'Alice')],
      replyTo: [address('EMMA@example.com')]
    }
    expect(replyRecipients(bare, 'reply', isSelf).to).toEqual([
      address('EMMA@example.com', 'Emma')
    ])
    expect(
      replyRecipients(
        { ...bare, replyTo: [address('alice@example.com')] },
        'replyAll',
        isSelf
      )
    ).toEqual({
      to: [address('alice@example.com', 'Alice'), address('dan@example.com')],
      cc: [],
      bcc: [address('brian@example.com')]
    })
  })

  it('keeps the name a recipient already has', () => {
    const named = {
      ...EMMA,
      replyTo: [address('emma@example.com', 'Emma Support')]
    }
    expect(replyRecipients(named, 'reply', isSelf).to).toEqual([
      address('emma@example.com', 'Emma Support')
    ])
  })

  it('puts nobody in a forward', () => {
    expect(replyRecipients(EMMA, 'forward', isSelf)).toEqual({
      to: [],
      cc: [],
      bcc: []
    })
  })
})

describe('listPostRecipients', () => {
  it('reads the mailto: URLs and their cc', () => {
    expect(
      listPostRecipients([
        'http://example.com/post',
        'mailto:list@example.com?cc=a%40example.com&subject=x'
      ])
    ).toEqual({
      to: [address('list@example.com')],
      cc: [address('a@example.com')],
      bcc: []
    })
    expect(hasListPost({ listPost: ['NO'] })).toBe(false)
    expect(hasListPost({ listPost: null })).toBe(false)
  })
})

describe('canReplyAll', () => {
  it('needs more than one address besides the user', () => {
    expect(canReplyAll(EMMA, isSelf)).toBe(true)
    expect(
      canReplyAll(
        { ...EMMA, cc: null, bcc: null, to: [address('bob@example.com')] },
        isSelf
      )
    ).toBe(false)
  })
})

describe('listPostRecipients against ReDoS', () => {
  it('reads a header with spaces around it as before', () => {
    expect(
      listPostRecipients([' \t<mailto:list@example.com?cc=a@b.c  >  '])
    ).toEqual({
      to: [{ name: null, email: 'list@example.com' }],
      cc: [{ name: null, email: 'a@b.c' }],
      bcc: []
    })
    expect(listPostRecipients(['mailto:list@example.com?cc  '])).toEqual({
      to: [{ name: null, email: 'list@example.com' }],
      cc: [],
      bcc: []
    })
  })

  it('rejects a long header in a linear time', () => {
    const header = 'mailto:?' + '\t'.repeat(50_000) + '>>'
    let recipients = null
    expect(
      elapsedMs(() => {
        recipients = listPostRecipients([header])
      })
    ).toBeLessThan(STRESS_TIME_LIMIT_MS)
    expect(recipients).toEqual({ to: [], cc: [], bcc: [] })
  })
})
