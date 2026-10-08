import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { StorageUsage } from './StorageUsage'

describe('StorageUsage', () => {
  it('says what is used and left, its gauge named by the use', () => {
    renderDs(
      <StorageUsage
        used="1.2 MB"
        ofLimit="of 50 MB used"
        available="Available: 48.8 MB"
        percent={2}
      />
    )

    expect(screen.getByText('Available: 48.8 MB')).toBeVisible()
    const gauge = screen.getByRole('progressbar', {
      name: '1.2 MB of 50 MB used'
    })
    expect(gauge).toHaveAttribute('aria-valuenow', '2')
  })
})
