import { renderHook } from '@testing-library/react'

import { useNewEmailCount } from './useNewEmailCount'

type Emails = Parameters<typeof useNewEmailCount>[0]

interface Props {
  emails: Emails
  listKey: string
}

function unread(receivedAt: string): Emails[number] {
  return { receivedAt, keywords: {} }
}

const OLD = [unread('2026-10-01T08:00:00Z')]
const NEWER = [unread('2026-10-02T08:00:00Z'), ...OLD]

function renderCount(
  emails: Emails,
  listKey: string
): ReturnType<typeof renderHook<number, Props>> {
  return renderHook(
    (props: Props) => useNewEmailCount(props.emails, true, props.listKey),
    { initialProps: { emails, listKey } }
  )
}

describe('useNewEmailCount', () => {
  it('counts an unread email more recent than the listed ones', () => {
    const { result, rerender } = renderCount(OLD, 'inbox')

    rerender({ emails: NEWER, listKey: 'inbox' })

    expect(result.current).toBe(1)
  })

  it('does not count the more recent emails of another list', () => {
    const { result, rerender } = renderCount(OLD, 'search:report')

    rerender({ emails: NEWER, listKey: 'search:lunch' })

    expect(result.current).toBe(0)
  })
})
