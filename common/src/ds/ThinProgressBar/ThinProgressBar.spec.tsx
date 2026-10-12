import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { ThinProgressBar } from './ThinProgressBar'

describe('ThinProgressBar', () => {
  it('is a progress bar named by its label, with the percentage done', () => {
    renderDs(<ThinProgressBar value={0.25} label="Emptying Trash" />)

    const bar = screen.getByRole('progressbar', { name: 'Emptying Trash' })
    expect(bar).toHaveAttribute('aria-valuenow', '25')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('has no value while the total is unknown', () => {
    renderDs(<ThinProgressBar value={null} label="Emptying Trash" />)

    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  })
})
