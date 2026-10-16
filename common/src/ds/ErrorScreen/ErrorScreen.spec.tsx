import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { ErrorScreen } from './ErrorScreen'

describe('ErrorScreen', () => {
  it('announces the error and runs its action', async () => {
    const onAction = jest.fn()
    renderDs(
      <ErrorScreen
        title="Something went wrong"
        description="Try again later"
        actionLabel="Retry"
        onAction={onAction}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Something went wrongTry again later'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('moves the focus to its action when asked to', () => {
    renderDs(
      <ErrorScreen
        title="Broken"
        actionLabel="Retry"
        onAction={jest.fn()}
        focusOnMount
      />
    )

    expect(screen.getByRole('button', { name: 'Retry' })).toHaveFocus()
  })

  it('moves the focus to the title without an action', () => {
    renderDs(<ErrorScreen title="Broken" focusOnMount />)

    expect(screen.getByRole('heading', { name: 'Broken' })).toHaveFocus()
  })

  it('has no action without a label and a handler', () => {
    renderDs(<ErrorScreen title="Broken" data-testid="broken" />)

    expect(screen.queryByRole('button')).toBe(null)
    expect(screen.getByTestId('broken')).toHaveTextContent('Broken')
  })

  it('leaves the focus alone, under a level-3 title, by default', () => {
    renderDs(<ErrorScreen title="Broken" />)

    expect(
      screen.getByRole('heading', { level: 3, name: 'Broken' })
    ).not.toHaveFocus()
  })

  it('puts the focus on its title at the level it is given', () => {
    renderDs(<ErrorScreen title="Broken" headingLevel="h1" focusOnMount />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Broken' })
    ).toHaveFocus()
  })
})
