import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeSettings
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { PreferencesSettings } from './PreferencesSettings'
import { SETTINGS_SECTIONS, type SettingsSection } from './sections'

function preferencesSection(): SettingsSection {
  const section = SETTINGS_SECTIONS.find(({ id }) => id === 'preferences')
  if (!section) throw new Error('No Preferences section')
  return section
}

describe('PreferencesSettings', () => {
  it('changes the server preferences, with their defaults', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    const settings = installFakeSettings(server)
    renderWithProviders(
      <PreferencesSettings section={preferencesSection()} />,
      {
        jmapServer: server,
        withJmapSession: true
      }
    )

    const readReceipts = await screen.findByRole('switch', {
      name: 'Always request read receipts with outgoing messages'
    })
    const senderPriority = screen.getByRole('switch', {
      name: 'Display sender-set important flag'
    })
    expect(readReceipts).not.toBeChecked()
    expect(senderPriority).toBeChecked()

    await userEvent.click(senderPriority)
    await waitFor(() => {
      expect(senderPriority).not.toBeChecked()
    })
    expect(settings.settings()).toEqual({ 'display.sender.priority': 'false' })

    await userEvent.click(readReceipts)
    await waitFor(() => {
      expect(readReceipts).toBeChecked()
    })
    expect(settings.settings()).toEqual({
      'display.sender.priority': 'false',
      'read.receipts.always': 'true'
    })
  })

  it('only has the conversations without server settings', async () => {
    renderWithProviders(
      <PreferencesSettings section={preferencesSection()} />,
      {
        withJmapSession: true
      }
    )

    expect(
      await screen.findByRole('switch', { name: 'Enable thread' })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('switch')).toHaveLength(1)
  })
})
