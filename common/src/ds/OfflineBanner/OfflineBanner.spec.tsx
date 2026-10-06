import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { OfflineBanner } from './OfflineBanner'

describe('OfflineBanner', () => {
  it('shows the message without being a live region of its own', () => {
    renderDs(
      <OfflineBanner
        message="No internet connection"
        dismissLabel="Dismiss"
        onDismiss={jest.fn()}
        data-testid="banner"
      />
    )

    expect(screen.getByTestId('banner')).toHaveTextContent(
      'No internet connection'
    )
    expect(screen.queryByRole('alert')).toBe(null)
    expect(screen.queryByRole('status')).toBe(null)
  })

  it('hides itself through its button', async () => {
    const onDismiss = jest.fn()
    renderDs(
      <OfflineBanner
        message="No internet connection"
        dismissLabel="Dismiss"
        onDismiss={onDismiss}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
