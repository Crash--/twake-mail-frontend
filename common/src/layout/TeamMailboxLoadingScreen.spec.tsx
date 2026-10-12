import { screen } from '@testing-library/react'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { TeamMailboxLoadingScreen } from './TeamMailboxLoadingScreen'

describe('TeamMailboxLoadingScreen', () => {
  it('shows the rows of the list 16 px inside the sides and the bottom of the frame', () => {
    renderWithProviders(<TeamMailboxLoadingScreen />)

    const rows = screen.getByTestId('email-list-loading')
    expect(rows).toHaveClass('u-ph-1')
    expect(rows).toHaveClass('u-pb-1')
  })
})
