import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { CenteredCard } from './CenteredCard'

describe('CenteredCard', () => {
  it('shows its content in the main landmark', () => {
    renderDs(
      <CenteredCard>
        <h1>Sign in</h1>
      </CenteredCard>
    )

    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { name: 'Sign in' })
    )
  })
})
