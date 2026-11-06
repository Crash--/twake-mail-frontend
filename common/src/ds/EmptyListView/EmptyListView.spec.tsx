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

  it('shows the action below the text and runs it', async () => {
    const onAction = jest.fn()
    renderDs(
      <EmptyListView
        title="Nothing here"
        actionLabel="Compose"
        onAction={onAction}
        data-testid="empty"
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Compose' }))

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('empty-action')).toHaveTextContent('Compose')
  })

  it('has no action without a handler', () => {
    renderDs(
      <EmptyListView
        title="Nothing here"
        actionLabel="Compose"
        data-testid="empty"
      />
    )

    expect(screen.queryByRole('button')).toBe(null)
  })
})
