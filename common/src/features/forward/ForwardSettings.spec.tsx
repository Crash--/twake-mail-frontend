import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { AppConfigProvider } from '@common/config/AppConfigProvider'
import { resolveConfig } from '@common/config/config'
import {
  SETTINGS_SECTIONS,
  type SettingsSection
} from '@common/features/settings/sections'
import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeForward
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { ForwardSettings } from './ForwardSettings'

function forwardingSection(): SettingsSection {
  const section = SETTINGS_SECTIONS.find(({ id }) => id === 'forwarding')
  if (!section) throw new Error('No Forwarding section')
  return section
}

function withWarning(ui: ReactElement, message: string): ReactElement {
  const result = resolveConfig(
    {
      JMAP_SESSION_URL: 'https://jmap.example.com/jmap/session',
      AUTH_MODE: 'basic',
      FORWARD_WARNING_MESSAGE: message
    },
    'https://mail.example.com'
  )
  if (!result.ok) throw new Error('Invalid configuration')
  return <AppConfigProvider config={result.value}>{ui}</AppConfigProvider>
}

function setup(
  forwards: string[] = [],
  warning: string | null = null
): ReturnType<typeof installFakeForward> {
  const server = makeFakeJmapServer({
    capabilities: FAKE_LINAGORA_CAPABILITIES
  })
  const fake = installFakeForward(server, { forwards })
  const ui = <ForwardSettings section={forwardingSection()} />
  renderWithProviders(warning === null ? ui : withWarning(ui, warning), {
    jmapServer: server,
    withJmapSession: true
  })
  return fake
}

describe('ForwardSettings', () => {
  it('adds an address of the domain, then offers to keep a copy', async () => {
    const fake = setup()

    const input = await screen.findByRole('textbox', { name: 'New recipient' })
    expect(screen.queryByRole('switch')).toBe(null)
    await userEvent.type(input, 'bob@example.com')
    await userEvent.click(screen.getByTestId('forward-add-button'))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'The emails has been added from the recipient list.'
    )
    expect(fake.forward()).toMatchObject({ forwards: ['bob@example.com'] })
    expect(input).toHaveValue('')
    const list = await screen.findByRole('list', {
      name: 'Forwarding addresses'
    })
    expect(within(list).getByText('bob@example.com')).toBeVisible()
    expect(screen.queryByTestId('forward-warning-banner')).toBe(null)

    const toggle = screen.getByRole('switch', { name: 'Keep a copy in Inbox' })
    expect(toggle).toBeChecked()
    await userEvent.click(toggle)
    await waitFor(() => {
      expect(fake.forward()).toMatchObject({ localCopy: false })
    })
  })

  it('refuses an invalid address', async () => {
    const fake = setup()

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'New recipient' }),
      'not-an-address'
    )
    await userEvent.click(screen.getByTestId('forward-add-button'))

    expect(
      screen.getByRole('textbox', { name: 'New recipient' })
    ).toHaveAccessibleDescription('Incorrect email format')
    expect(fake.forward()).toMatchObject({ forwards: [] })
  })

  it('warns before forwarding outside the domain, with the deployment message', async () => {
    const fake = setup([], 'Forwarding outside is forbidden by the charter.')

    await userEvent.type(
      await screen.findByRole('textbox', { name: 'New recipient' }),
      'me@gmail.com'
    )
    await userEvent.click(screen.getByTestId('forward-add-button'))
    const warning = screen.getByRole('dialog', {
      name: 'You are redirecting emails to another domain.'
    })
    expect(warning).toHaveTextContent(
      'Forwarding outside is forbidden by the charter.'
    )
    await userEvent.click(
      within(warning).getByTestId('confirm-dialog-cancel-button')
    )
    expect(fake.forward()).toMatchObject({ forwards: [] })

    await userEvent.click(screen.getByTestId('forward-add-button'))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes' })
    )

    expect(
      await screen.findByTestId('forward-warning-banner')
    ).toHaveTextContent('Forwarding outside is forbidden by the charter.')
    expect(fake.forward()).toMatchObject({ forwards: ['me@gmail.com'] })
    expect(screen.getByTestId('forward-item')).toHaveTextContent(
      'External domain'
    )
  })

  it('removes an address once confirmed', async () => {
    const fake = setup(['bob@example.com', 'carol@example.com'])

    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove bob@example.com' })
    )
    const confirm = screen.getByRole('dialog', { name: 'Remove recipients' })
    expect(confirm).toHaveTextContent(
      'Do you want to delete email bob@example.com?'
    )
    await userEvent.click(
      within(confirm).getByTestId('confirm-dialog-confirm-button')
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'The email has been removed from the recipient list.'
    )
    expect(fake.forward()).toMatchObject({ forwards: ['carol@example.com'] })
  })
})
