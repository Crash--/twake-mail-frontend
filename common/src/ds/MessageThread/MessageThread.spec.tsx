import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { ReadingInsetContext } from '@/ds/ReadingPane/ReadingPane'
import { renderDs } from '@/ds/testing/renderDs'

import { MessageThread } from './MessageThread'
import { MessageThreadItem } from './MessageThreadItem'

function Thread(): ReactElement {
  const [expanded, setExpanded] = useState<string[]>(['c'])
  const toggle = (id: string): void => {
    setExpanded(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    )
  }
  return (
    <MessageThread label="Messages of the conversation">
      {['a', 'b', 'c'].map(id => (
        <MessageThreadItem
          key={id}
          isExpanded={expanded.includes(id)}
          onToggle={() => {
            toggle(id)
          }}
          header={`Message ${id}`}
        >
          <p>{`Body of ${id}`}</p>
        </MessageThreadItem>
      ))}
    </MessageThread>
  )
}

describe('MessageThread', () => {
  it('lists the messages, each toggled by its header', async () => {
    renderDs(<Thread />)

    expect(
      screen.getByRole('list', { name: 'Messages of the conversation' })
    ).toBeVisible()
    const first = screen.getByRole('button', { name: 'Message a' })
    expect(first).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Body of a')).toBe(null)
    const region = screen.getByRole('region', { name: 'Message c' })
    expect(region).toHaveTextContent('Body of c')
    expect(screen.getByRole('button', { name: 'Message c' })).toHaveAttribute(
      'aria-controls',
      region.id
    )

    await userEvent.click(first)

    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Body of a')).toBeVisible()
  })

  it('moves the focus between the messages with the arrows, Home and End', async () => {
    renderDs(<Thread />)
    const [a, b, c] = ['a', 'b', 'c'].map(id =>
      screen.getByRole('button', { name: `Message ${id}` })
    )
    a?.focus()

    await userEvent.keyboard('{ArrowDown}')
    expect(b).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(c).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(c).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(b).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(a).toHaveFocus()
  })

  it('keeps 8 px at the sides of a reading view inset in its frame, more otherwise', () => {
    const { unmount } = renderDs(<Thread />)
    expect(screen.getByRole('region', { name: 'Message c' })).not.toHaveStyle({
      paddingLeft: '8px'
    })
    unmount()

    renderDs(
      <ReadingInsetContext.Provider value>
        <Thread />
      </ReadingInsetContext.Provider>
    )
    expect(screen.getByRole('region', { name: 'Message c' })).toHaveStyle({
      paddingLeft: '8px'
    })
  })

  it('stops a message scrolled to below the sticky bar, unless the bar is out of the scrolling area', () => {
    const { unmount } = renderDs(<Thread />)
    expect(screen.getByRole('button', { name: 'Message a' })).toHaveStyle({
      scrollMarginTop: '4rem'
    })
    unmount()

    renderDs(
      <ReadingInsetContext.Provider value>
        <Thread />
      </ReadingInsetContext.Provider>
    )
    expect(screen.getByRole('button', { name: 'Message a' })).toHaveStyle({
      scrollMarginTop: '0'
    })
  })
})
