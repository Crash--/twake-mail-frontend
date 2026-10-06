import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'

import { ComposerProvider } from '@common/features/composer/ComposerProvider'
import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import { FAKE_LINAGORA_CAPABILITIES } from '@common/testing/fakeLinagora'
import { resolveConfig, type AppConfig } from '@common/config/config'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EmailAddressCard } from './EmailAddressCard'

const BOB = { name: 'Bob', email: 'bob@example.com' }

function makeConfig(source: Record<string, string>): AppConfig {
  const result = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      AUTH_MODE: 'basic',
      APP_VERSION: '1.2.3',
      ...source
    },
    'https://mail.example.com',
    () => undefined
  )
  if (!result.ok) throw new Error(result.errors.join(', '))
  return result.value
}

function RuleTarget(): React.ReactElement {
  return <p>Rules page</p>
}

describe('EmailAddressCard', () => {
  it('copies the address', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <EmailAddressCard address={BOB}>Bob</EmailAddressCard>,
      {
        withJmapSession: true
      }
    )

    await user.click(await screen.findByRole('button', { name: 'Bob' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Copy the email address'
      })
    )

    expect(await navigator.clipboard.readText()).toBe('bob@example.com')
    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Email address copied'
    )
  })

  it('opens the rule creator for the address when the server has rules', async () => {
    renderWithProviders(
      <EmailAddressCard address={BOB}>Bob</EmailAddressCard>,
      {
        withJmapSession: true,
        jmapServer: makeFakeJmapServer({
          capabilities: FAKE_LINAGORA_CAPABILITIES
        }),
        routes: <Route path="/settings/email-rules" element={<RuleTarget />} />
      }
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Bob' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Create a rule with this email' })
    )

    expect(await screen.findByText('Rules page')).toBeVisible()
  })

  it('offers no rule without the filter extension', async () => {
    renderWithProviders(
      <EmailAddressCard address={BOB}>Bob</EmailAddressCard>,
      {
        withJmapSession: true
      }
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Bob' }))

    expect(
      screen.queryByRole('button', { name: 'Create a rule with this email' })
    ).toBe(null)
  })

  it('writes to the address in a new message', async () => {
    renderWithProviders(
      <ComposerProvider>
        <EmailAddressCard address={BOB}>Bob</EmailAddressCard>
      </ComposerProvider>,
      { withJmapSession: true }
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Bob' }))
    await userEvent.click(screen.getByRole('button', { name: 'Compose email' }))

    const composer = await screen.findByRole('dialog', { name: 'New message' })
    expect(
      await within(composer).findByRole('button', { name: /bob@example.com/ })
    ).toBeVisible()
  })

  it('shows the avatar, the name and the address in a named dialog', async () => {
    renderWithProviders(
      <EmailAddressCard address={BOB}>Bob</EmailAddressCard>,
      { withJmapSession: true }
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Bob' }))

    const card = await screen.findByRole('dialog', { name: 'Bob' })
    expect(within(card).getByText('bob@example.com')).toBeVisible()
    expect(within(card).getByText('BO')).toBeInTheDocument()
  })

  it('names the dialog by the address when there is no name', async () => {
    renderWithProviders(
      <EmailAddressCard address={{ name: null, email: 'eve@example.com' }}>
        eve@example.com
      </EmailAddressCard>,
      { withJmapSession: true }
    )

    await userEvent.click(
      await screen.findByRole('button', { name: 'eve@example.com' })
    )

    expect(
      await screen.findByRole('dialog', { name: 'eve@example.com' })
    ).toBeVisible()
  })

  it('closes on Escape and gives the focus back to the address', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <EmailAddressCard address={BOB}>Bob</EmailAddressCard>,
      { withJmapSession: true }
    )
    const trigger = await screen.findByRole('button', { name: 'Bob' })

    await user.click(trigger)
    const card = await screen.findByRole('dialog', { name: 'Bob' })
    expect(card).toContainElement(document.activeElement as HTMLElement)
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(trigger).toHaveFocus()
  })

  it('closes with its close button', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <EmailAddressCard address={BOB}>Bob</EmailAddressCard>,
      { withJmapSession: true }
    )

    await user.click(await screen.findByRole('button', { name: 'Bob' }))
    await user.click(await screen.findByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
  })

  it('offers neither an invitation nor a chat without their integration', async () => {
    renderWithProviders(
      <EmailAddressCard address={BOB}>Bob</EmailAddressCard>,
      { withJmapSession: true, config: makeConfig({}) }
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Bob' }))

    expect(screen.queryByRole('link', { name: 'Invite to an event' })).toBe(
      null
    )
    expect(screen.queryByRole('link', { name: 'Chat' })).toBe(null)
  })

  it('invites to an event and chats when Calendar and Chat are configured', async () => {
    renderWithProviders(
      <EmailAddressCard address={BOB}>Bob</EmailAddressCard>,
      {
        withJmapSession: true,
        config: makeConfig({
          CALENDAR_SPA_URL: 'https://calendar.example.com',
          CHAT_SPA_URL: 'https://chat.example.com/#/chat/@{target}'
        })
      }
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Bob' }))

    const invite = screen.getByRole('link', { name: 'Invite to an event' })
    expect(invite).toHaveAttribute(
      'href',
      'https://calendar.example.com/newEvent?attendee=bob%40example.com'
    )
    expect(invite).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute(
      'href',
      'https://chat.example.com/#/chat/@bob'
    )
  })

  it('is a mailto link opening the card, not the mail program, in running text', async () => {
    renderWithProviders(
      <EmailAddressCard address={BOB} isInline>
        Bob
      </EmailAddressCard>,
      { withJmapSession: true }
    )

    const link = await screen.findByRole('link', { name: 'Bob' })
    expect(link).toHaveAttribute('href', 'mailto:bob@example.com')
    expect(link).toHaveAttribute('aria-haspopup', 'dialog')
    await userEvent.click(link)

    expect(await screen.findByRole('dialog', { name: 'Bob' })).toBeVisible()
  })
})
