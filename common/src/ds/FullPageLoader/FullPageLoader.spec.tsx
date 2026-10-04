import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { FullPageLoader } from './FullPageLoader'

describe('FullPageLoader', () => {
  it('shows a progress bar named by its label', () => {
    renderDs(<FullPageLoader label="Loading" data-testid="loader" />)

    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeVisible()
    expect(screen.getByTestId('loader')).toHaveAttribute('aria-busy', 'true')
  })
})
