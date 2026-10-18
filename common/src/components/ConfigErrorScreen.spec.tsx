import { screen } from '@testing-library/react'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { ConfigErrorScreen } from './ConfigErrorScreen'

describe('ConfigErrorScreen', () => {
  it('is the whole page: its main landmark, under a level-1 title', () => {
    renderWithProviders(
      <ConfigErrorScreen errors={['SERVER_URL is missing']} />
    )

    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', {
        level: 1,
        name: 'Twake Mail is not configured'
      })
    )
  })

  it('lists the errors for the administrator', () => {
    renderWithProviders(
      <ConfigErrorScreen
        errors={['SERVER_URL is missing', 'LANG is invalid']}
      />
    )

    expect(screen.getByTestId('config-error')).toHaveTextContent(
      'SERVER_URL is missing'
    )
    expect(screen.getByTestId('config-error')).toHaveTextContent(
      'LANG is invalid'
    )
  })
})
