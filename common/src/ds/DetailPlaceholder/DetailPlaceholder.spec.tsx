import { screen } from '@testing-library/react'

import { renderDs } from '@/ds/testing/renderDs'

import { DetailPlaceholder } from './DetailPlaceholder'

describe('DetailPlaceholder', () => {
  it('says that nothing is open, as a heading', () => {
    renderDs(
      <DetailPlaceholder title="No email selected" data-testid="empty" />
    )

    expect(
      screen.getByRole('heading', { name: 'No email selected' })
    ).toBeVisible()
    expect(screen.getByTestId('empty')).toHaveTextContent('No email selected')
  })
})
