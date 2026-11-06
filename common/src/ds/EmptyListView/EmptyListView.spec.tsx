import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { EmptyListView } from './EmptyListView'

describe('EmptyListView', () => {
  it('shows the title and the hint below a decorative drawing', () => {
    renderDs(
      <EmptyListView
        title="Nothing here"
        text="Start to compose emails."
        data-testid="empty"
      />
    )

    const view = screen.getByTestId('empty')
    expect(view).toHaveTextContent('Nothing hereStart to compose emails.')
    expect(view.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).toBe(null)
  })

  it('has no hint without a text', () => {
    renderDs(<EmptyListView title="Nothing here" data-testid="empty" />)

    expect(screen.getByTestId('empty').querySelectorAll('p')).toHaveLength(1)
  })

  it('has no action by default', () => {
    renderDs(<EmptyListView title="Nothing here" data-testid="empty" />)

    expect(screen.queryByRole('button')).toBe(null)
  })

  it('offers its action as a button below the hint', async () => {
    const onClick = jest.fn()
    renderDs(
      <EmptyListView
        title="Nothing here"
        text="Deleted something by mistake?"
        action={{
          label: 'Recover deleted messages',
          onClick,
          'data-testid': 'recover'
        }}
        data-testid="empty"
      />
    )

    const button = screen.getByRole('button', {
      name: 'Recover deleted messages'
    })
    expect(button).toHaveAttribute('data-testid', 'recover')
    await userEvent.tab()
    expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('lets the title take the focus when it has a ref', () => {
    const titleRef = { current: null as HTMLParagraphElement | null }
    renderDs(<EmptyListView title="Nothing here" titleRef={titleRef} />)

    titleRef.current?.focus()

    expect(screen.getByText('Nothing here')).toHaveFocus()
  })
})
