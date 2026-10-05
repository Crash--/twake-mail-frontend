import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderDs } from '@/ds/testing/renderDs'

import { OfflineBanner } from './OfflineBanner'

describe('OfflineBanner', () => {
  it('announces the message as an alert', () => {
    renderDs(
      <OfflineBanner
        message="No internet connection"
        dismissLabel="Dismiss"
        onDismiss={jest.fn()}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No internet connection'
    )
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
