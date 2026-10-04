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

  it('has no action without a label and a handler', () => {
    renderDs(<ErrorScreen title="Broken" data-testid="broken" />)

    expect(screen.queryByRole('button')).toBe(null)
    expect(screen.getByTestId('broken')).toHaveTextContent('Broken')
  })
})
