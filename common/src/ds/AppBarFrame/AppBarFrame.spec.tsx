import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { AppBarFrame, AppBarLeft } from './AppBarFrame'

describe('AppBarFrame', () => {
  it('frames the bar and its start, closed by a divider', () => {
    renderDs(
      <AppBarFrame>
        <header>
          <AppBarLeft width={236}>Logo</AppBarLeft>
        </header>
      </AppBarFrame>
    )

    const bar = screen.getByRole('banner')
    expect(bar).toHaveTextContent('Logo')
    expect(bar).toHaveStyle({ borderBottomWidth: '1px' })
  })

  it('keeps the divider on the plain bar', () => {
    renderDs(
      <AppBarFrame isPlain>
        <header>Bar</header>
      </AppBarFrame>
    )

    expect(screen.getByRole('banner')).toHaveStyle({
      borderBottomWidth: '1px'
    })
  })
})
