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

  it('offers the label categorisation with the AI capability only', async () => {
    const server = makeFakeJmapServer({
      capabilities: {
        ...FAKE_LINAGORA_CAPABILITIES,
        'com:linagora:params:jmap:aibot': {}
      }
    })
    const settings = installFakeSettings(server)
    renderWithProviders(
      <PreferencesSettings section={preferencesSection()} />,
      { jmapServer: server, withJmapSession: true }
    )

    const toggle = await screen.findByRole('switch', {
      name: 'Enable label categorisation'
    })
    expect(toggle).not.toBeChecked()
    // Without a scribe endpoint, no AI Scribe option
    expect(screen.queryByRole('switch', { name: 'Enable AI Scribe' })).toBe(
      null
    )
    await userEvent.click(toggle)
    await waitFor(() => {
      expect(toggle).toBeChecked()
    })
    expect(settings.settings()).toEqual({
      'ai.label-categorization.enabled': 'true'
    })
  })

  it('has no AI option without the AI capability', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES
    })
    installFakeSettings(server)
    renderWithProviders(
      <PreferencesSettings section={preferencesSection()} />,
      { jmapServer: server, withJmapSession: true }
    )

    await screen.findByRole('switch', { name: 'Enable thread' })
    expect(
      screen.queryByRole('switch', { name: 'Enable label categorisation' })
    ).toBe(null)
  })

  it('hides the AI assistant on request, when the server has one', async () => {
    window.localStorage.clear()
    const server = makeFakeJmapServer({
      capabilities: {
        'com:linagora:params:jmap:aibot': {
          scribeEndpoint: 'https://scribe.example.test/chat'
        }
      }
    })
    renderWithProviders(
      <PreferencesSettings section={preferencesSection()} />,
      { jmapServer: server, withJmapSession: true }
    )

    const toggle = await screen.findByRole('switch', {
      name: 'Enable AI Scribe'
    })
    expect(toggle).toBeChecked()
    await userEvent.click(toggle)
    expect(toggle).not.toBeChecked()
    expect(
      window.localStorage.getItem('twake-mail.preferences.ai-scribe')
    ).toBe('false')
    window.localStorage.clear()
  })
})
