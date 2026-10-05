import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { StorageGauge } from './StorageGauge'

describe('StorageGauge', () => {
  it('is a progress bar named by its label, with a readable value', () => {
    renderDs(
      <>
        <p id="label">Storage</p>
        <StorageGauge
          value={40}
          labelledBy="label"
          valueText="2 MB of 5 MB used"
        />
      </>
    )

    const gauge = screen.getByRole('progressbar', { name: 'Storage' })
    expect(gauge).toHaveAttribute('aria-valuenow', '40')
    expect(gauge).toHaveAttribute('aria-valuetext', '2 MB of 5 MB used')
  })

  it('stays between 0 and 100', () => {
    renderDs(<StorageGauge value={140} labelledBy="label" valueText="over" />)

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100'
    )
  })
})
