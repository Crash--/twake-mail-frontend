import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { AppBarFrame, AppBarLeft, AppBarSearch } from './AppBarFrame'

describe('AppBarFrame', () => {
  it('frames the bar, its start and its search', () => {
    renderDs(
      <AppBarFrame>
        <header>
          <AppBarLeft width={236}>Logo</AppBarLeft>
          <AppBarSearch>Search</AppBarSearch>
        </header>
      </AppBarFrame>
    )

    expect(screen.getByRole('banner')).toHaveTextContent('LogoSearch')
  })
})
