import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { RowDate } from './RowDate'

describe('RowDate', () => {
  it('is Semi Bold when the row stands out, Regular otherwise', () => {
    renderDs(
      <>
        <RowDate isStrong data-testid="strong">
          Aug 29
        </RowDate>
        <RowDate data-testid="regular">Aug 28</RowDate>
      </>
    )

    expect(screen.getByTestId('strong')).toHaveStyle({ fontWeight: '600' })
    expect(screen.getByTestId('regular')).toHaveStyle({ fontWeight: '400' })
  })
})
