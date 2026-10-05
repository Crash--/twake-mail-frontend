import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeVacation
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { VacationBanner } from './VacationBanner'

function setup(
  initial: Record<string, unknown>,
  route = '/'
): ReturnType<typeof installFakeVacation> {
  const server = makeFakeJmapServer({
    capabilities: FAKE_LINAGORA_CAPABILITIES
  })
  const fake = installFakeVacation(server, initial)
  renderWithProviders(<VacationBanner />, {
    jmapServer: server,
    withJmapSession: true,
    route
  })
  return fake
}

describe('VacationBanner', () => {
  it('says vacation responses are sent, and ends them', async () => {
    const fake = setup({
      isEnabled: true,
      fromDate: '2020-01-01T00:00:00Z',
      htmlBody: '<p>Away</p>'
    })

    expect(await screen.findByTestId('vacation-banner')).toHaveTextContent(
      'Your vacation responder is enabled.'
    )
    expect(
      screen.getByRole('link', { name: 'Vacation setting' })
    ).toHaveAttribute('href', '/settings/vacation')
    await userEvent.click(screen.getByRole('button', { name: 'End now' }))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Your vacation responder is disabled successfully'
    )
    expect(fake.vacation()).toMatchObject({
      isEnabled: false,
      htmlBody: '<p>Away</p>'
    })
    await waitFor(() => {
      expect(screen.queryByTestId('vacation-banner')).toBe(null)
    })
  })

  it('says nothing of a response to come, but on its settings', async () => {
    setup(
      { isEnabled: true, fromDate: '2999-01-01T00:00:00Z' },
      '/settings/vacation'
    )

    expect(await screen.findByTestId('vacation-banner')).toHaveTextContent(
      'Your vacation responder will be activated on'
    )
  })

  it('turns off a response whose end passed', async () => {
    const fake = setup({
      isEnabled: true,
      fromDate: '2020-01-01T00:00:00Z',
      toDate: '2020-01-10T00:00:00Z'
    })

    await waitFor(() => {
      expect(fake.vacation()).toMatchObject({ isEnabled: false })
    })
    expect(screen.queryByTestId('vacation-banner')).toBe(null)
  })
})
