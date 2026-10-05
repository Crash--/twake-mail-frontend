import {
  isOpenedFromList,
  OPENED_FROM_LIST,
  pickTargetMessageId
} from './conversationTarget'

const READ = { $seen: true } as const

function message(
  id: string,
  keywords: Record<string, true> = READ
): { id: string; keywords: Record<string, true> } {
  return { id, keywords }
}

describe('pickTargetMessageId', () => {
  it('is the first unread message from a list', () => {
    const emails = [
      message('a'),
      message('b', {}),
      message('c', {}),
      message('d')
    ]

    expect(pickTargetMessageId(emails, 'd', true)).toBe('b')
  })

  it('is the latest message from a list when all are read', () => {
    const emails = [message('a'), message('b'), message('c')]

    expect(pickTargetMessageId(emails, 'a', true)).toBe('c')
  })

  it('is the email opened from a result or a link, even when others are unread', () => {
    const emails = [message('a', {}), message('b'), message('c', {})]

    expect(pickTargetMessageId(emails, 'b', false)).toBe('b')
  })

  it('is the latest message when the email opened is not in the conversation', () => {
    const emails = [message('a'), message('b')]

    expect(pickTargetMessageId(emails, 'gone', false)).toBe('b')
  })
})

describe('isOpenedFromList', () => {
  it('reads the state a list navigates with', () => {
    expect(isOpenedFromList(OPENED_FROM_LIST)).toBe(true)
  })

  it.each([null, undefined, {}, { focusEmailId: 'a' }, 'list'])(
    'is false for %p',
    state => {
      expect(isOpenedFromList(state)).toBe(false)
    }
  )
})
