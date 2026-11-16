import { screen, within } from '@testing-library/react'
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

  it('shows what goes under the header in the surface of its hover, outside the toggle and the message', async () => {
    const onToggle = jest.fn()
    renderDs(
      <MessageThread label="Messages of the conversation">
        <MessageThreadItem
          isExpanded
          onToggle={onToggle}
          header="Message a"
          headerBelow={<button type="button">To: Bob</button>}
        >
          <p>Body of a</p>
        </MessageThreadItem>
      </MessageThread>
    )

    const toggle = screen.getByRole('button', { name: 'Message a' })
    const below = screen.getByRole('button', { name: 'To: Bob' })
    // The surface: the parent of the row holding the heading of the toggle
    const surface = toggle.closest('h2')?.parentElement?.parentElement
    expect(surface).toContainElement(below)
    expect(toggle).not.toContainElement(below)
    expect(
      screen.getByRole('region', { name: 'Message a' })
    ).not.toContainElement(below)
    await userEvent.click(below)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('puts the toggle of each message in a level-2 heading', () => {
    renderDs(<Thread />)

    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings.map(heading => heading.textContent)).toEqual([
      'Message a',
      'Message b',
      'Message c'
    ])
    headings.forEach(heading => {
      expect(within(heading).getByRole('button')).toHaveAttribute(
        'aria-expanded'
      )
    })
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
