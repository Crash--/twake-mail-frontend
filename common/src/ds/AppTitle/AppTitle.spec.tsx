import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { AppTitle } from './AppTitle'

describe('AppTitle', () => {
  it('is one image named by its label', () => {
    renderDs(<AppTitle label="Twake Mail" data-testid="app-title" />)

    expect(screen.getByRole('img', { name: 'Twake Mail' })).toBe(
      screen.getByTestId('app-title')
    )
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })
})
