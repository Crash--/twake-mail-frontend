import { fireEvent, screen } from '@testing-library/react'
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
})
