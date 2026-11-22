import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { RowLink } from './RowLink'

function renderLink(onNavigate = jest.fn()): jest.Mock {
  renderDs(
    <RowLink href="/mailbox/inbox/email/42" onNavigate={onNavigate}>
      Unread, Hello
    </RowLink>
  )
  return onNavigate
}

describe('RowLink', () => {
  it('is a real link, named by its content', () => {
    renderLink()

    expect(screen.getByRole('link', { name: 'Unread, Hello' })).toHaveAttribute(
      'href',
      '/mailbox/inbox/email/42'
    )
  })

  it('navigates in the app on a plain click or Enter', async () => {
    const onNavigate = renderLink()
    const link = screen.getByRole('link')

    await userEvent.click(link)
    link.focus()
    await userEvent.keyboard('{Enter}')

    expect(onNavigate).toHaveBeenCalledTimes(2)
  })

  it('leaves the browser open a new tab on Ctrl+click or middle click', () => {
    const onNavigate = renderLink()
    const link = screen.getByRole('link')

    const ctrlClick = fireEvent.click(link, { ctrlKey: true })
    const middleClick = fireEvent.click(link, { button: 1 })

    expect(onNavigate).not.toHaveBeenCalled()
    // fireEvent returns false when the default action was prevented
    expect([ctrlClick, middleClick]).toEqual([true, true])
  })

  it('marks the item open beside the list as current', () => {
    renderDs(
      <RowLink href="/mailbox/inbox/email/42" onNavigate={jest.fn()} current>
        Hello
      </RowLink>
    )

    expect(screen.getByRole('link', { name: 'Hello' })).toHaveAttribute(
      'aria-current',
      'true'
    )
  })

  it('lets its lines wrap when it spans several', () => {
    renderDs(
      <RowLink href="/mailbox/inbox/email/42" onNavigate={jest.fn()} multiline>
        Hello
      </RowLink>
    )

    const link = screen.getByRole('link', { name: 'Hello' })
    expect(link).not.toHaveClass('u-ellipsis')
    expect(link).not.toHaveAttribute('aria-current')
  })

  describe('with a long press', () => {
    /** jsdom has no PointerEvent: a mouse event that says it is a finger */
    function touchDown(element: HTMLElement): void {
      const event = new MouseEvent('pointerdown', {
        bubbles: true,
        clientX: 5,
        clientY: 5
      })
      Object.defineProperty(event, 'pointerType', { value: 'touch' })
      fireEvent(element, event)
    }

    function renderPressable(): {
      onNavigate: jest.Mock
      onLongPress: jest.Mock
      onRowMenu: jest.Mock
    } {
      const onNavigate = jest.fn()
      const onLongPress = jest.fn()
      const onRowMenu = jest.fn()
      renderDs(
        <div onContextMenu={onRowMenu}>
          <RowLink
            href="/mailbox/inbox/email/42"
            onNavigate={onNavigate}
            onLongPress={onLongPress}
          >
            Hello
          </RowLink>
        </div>
      )
      return { onNavigate, onLongPress, onRowMenu }
    }

    beforeEach(() => {
      jest.useFakeTimers()
    })
    afterEach(() => {
      jest.useRealTimers()
    })

    it('calls it for a finger held on the row, whose release opens nothing', () => {
      const { onNavigate, onLongPress, onRowMenu } = renderPressable()
      const link = screen.getByRole('link')

      touchDown(link)
      act(() => {
        jest.advanceTimersByTime(500)
      })
      // Android reports the same press as a context menu, finger down
      fireEvent.contextMenu(link)
      fireEvent.pointerUp(link)
      fireEvent.click(link)

      expect(onLongPress).toHaveBeenCalledTimes(1)
      expect(onNavigate).not.toHaveBeenCalled()
      expect(onRowMenu).not.toHaveBeenCalled()
    })

    it('leaves a context menu before the end of the press to the row', () => {
      const { onLongPress, onRowMenu } = renderPressable()
      const link = screen.getByRole('link')

      touchDown(link)
      fireEvent.contextMenu(link)
      act(() => {
        jest.advanceTimersByTime(1000)
      })

      expect(onRowMenu).toHaveBeenCalledTimes(1)
      expect(onLongPress).not.toHaveBeenCalled()
    })
  })
})
