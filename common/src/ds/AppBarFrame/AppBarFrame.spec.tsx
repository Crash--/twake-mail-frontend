import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { AppBarFrame, AppBarLeft } from './AppBarFrame'

describe('AppBarFrame', () => {
  it('frames the bar and its start', () => {
    renderDs(
      <AppBarFrame>
        <header>
          <AppBarLeft width={236}>Logo</AppBarLeft>
        </header>
      </AppBarFrame>
    )

    expect(screen.getByRole('banner')).toHaveTextContent('Logo')
  })
})
