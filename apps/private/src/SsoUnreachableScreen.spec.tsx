import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { SsoUnreachableScreen } from './SsoUnreachableScreen'

describe('SsoUnreachableScreen', () => {
  it('is the whole page: its main landmark, under a level-1 title', () => {
    renderWithProviders(
      <SsoUnreachableScreen reason="sso-unreachable" onRetry={jest.fn()} />
    )

    const main = screen.getByRole('main')
    expect(main).toContainElement(
      screen.getByRole('heading', {
        level: 1,
        name: 'Cannot reach the sign-in service'
      })
    )
    expect(main).toContainElement(screen.getByTestId('sso-unreachable'))
    expect(screen.queryByRole('img')).toBe(null)
  })

  it('has the level-1 title of an unexpected failure as well', () => {
    renderWithProviders(
      <SsoUnreachableScreen reason="unexpected" onRetry={jest.fn()} />
    )

    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', {
        level: 1,
        name: 'Error! An error occurred. Please try again later.'
      })
    )
  })

  it('focuses Retry, which retries', async () => {
    const onRetry = jest.fn()
    renderWithProviders(
      <SsoUnreachableScreen reason="sso-unreachable" onRetry={onRetry} />
    )

    const retry = screen.getByRole('button', { name: 'Retry' })
    expect(retry).toHaveFocus()
    await userEvent.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
