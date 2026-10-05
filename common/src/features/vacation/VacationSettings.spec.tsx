import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  SETTINGS_SECTIONS,
  type SettingsSection
} from '@common/features/settings/sections'
import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeVacation
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { VacationSettings } from './VacationSettings'

function vacationSection(): SettingsSection {
  const section = SETTINGS_SECTIONS.find(({ id }) => id === 'vacation')
  if (!section) throw new Error('No Vacation section')
  return section
}

function setup(
  initial: Record<string, unknown> = {}
): ReturnType<typeof installFakeVacation> {
  const server = makeFakeJmapServer({
    capabilities: FAKE_LINAGORA_CAPABILITIES
  })
  const fake = installFakeVacation(server, initial)
  renderWithProviders(<VacationSettings section={vacationSection()} />, {
    jmapServer: server,
    withJmapSession: true
  })
  return fake
}

describe('VacationSettings', () => {
  it('turns the vacation response on, from a date until another', async () => {
    const fake = setup()

    expect(
      await screen.findByTestId('vacation-message-editor')
    ).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(
      await screen.findByRole('switch', {
        name: 'Automatically reply to messages when they are received.'
      })
    )
    await waitFor(() => {
      expect(screen.getByTestId('vacation-message-editor')).toHaveAttribute(
        'contenteditable',
        'true'
      )
    })
    expect(screen.getByTestId('vacation-message-editor')).not.toHaveAttribute(
      'aria-disabled'
    )
    fireEvent.change(screen.getByLabelText(/^Start date/), {
      target: { value: '2026-10-10' }
    })
    fireEvent.change(screen.getByLabelText(/^Start time/), {
      target: { value: '09:00' }
    })
    await userEvent.click(
      screen.getByRole('switch', { name: 'Vacation stops at' })
    )
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-10-20' }
    })
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Subject' }),
      'Away'
    )
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Message' }),
      'Back on the 20th'
    )
    await userEvent.click(screen.getByTestId('vacation-save-button'))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Vacation settings saved'
    )
    expect(fake.vacation()).toEqual({
      id: 'singleton',
      isEnabled: true,
      fromDate: '2026-10-10T09:00:00Z',
      toDate: '2026-10-20T00:00:00Z',
      subject: 'Away',
      textBody: 'Back on the 20th',
      htmlBody: '<p>Back on the 20th</p>'
    })
  })

  it('refuses an end before the start', async () => {
    const fake = setup({
      isEnabled: true,
      fromDate: '2026-10-10T09:00:00Z',
      htmlBody: '<p>Away</p>'
    })

    await userEvent.click(
      await screen.findByRole('switch', { name: 'Vacation stops at' })
    )
    fireEvent.change(screen.getByLabelText('End date'), {
      target: { value: '2026-10-01' }
    })
    await userEvent.click(screen.getByTestId('vacation-save-button'))

    expect(screen.getByTestId('vacation-error')).toHaveTextContent(
      'End date must be greater than start date'
    )
    expect(fake.vacation()).toMatchObject({ toDate: null })
  })

  it('turns it off, keeping the message for next time', async () => {
    const fake = setup({
      isEnabled: true,
      fromDate: '2026-10-10T09:00:00Z',
      subject: 'Away',
      htmlBody: '<p>Away</p>'
    })

    const form = await screen.findByTestId('vacation-form')
    await userEvent.click(
      within(form).getByRole('switch', {
        name: 'Automatically reply to messages when they are received.'
      })
    )
    expect(screen.getByLabelText(/^Start date/)).toBeDisabled()
    const message = screen.getByTestId('vacation-message-editor')
    expect(message).toHaveAttribute('aria-disabled', 'true')
    expect(message).toHaveAttribute('contenteditable', 'false')
    expect(message).toHaveTextContent('Away')
    await userEvent.click(screen.getByTestId('vacation-save-button'))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Vacation settings saved'
    )
    expect(fake.vacation()).toEqual({
      id: 'singleton',
      isEnabled: false,
      fromDate: null,
      toDate: null,
      subject: null,
      textBody: null,
      htmlBody: '<p>Away</p>'
    })
  })
})
