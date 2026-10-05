import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'

import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import { FAKE_LINAGORA_CAPABILITIES } from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EmailAddressMenu } from './EmailAddressMenu'

const BOB = { name: 'Bob', email: 'bob@example.com' }

function RuleTarget(): React.ReactElement {
  return <p>Rules page</p>
}

describe('EmailAddressMenu', () => {
  it('copies the address', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <EmailAddressMenu address={BOB}>Bob</EmailAddressMenu>,
      {
        withJmapSession: true
      }
    )

    await user.click(await screen.findByRole('button', { name: 'Bob' }))
    await user.click(screen.getByRole('menuitem', { name: 'Copy' }))

    expect(await navigator.clipboard.readText()).toBe('bob@example.com')
    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Email address copied'
    )
  })

  it('opens the rule creator for the address when the server has rules', async () => {
    renderWithProviders(
      <EmailAddressMenu address={BOB}>Bob</EmailAddressMenu>,
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
      screen.getByRole('menuitem', { name: 'Create a rule with this email' })
    )

    expect(await screen.findByText('Rules page')).toBeVisible()
  })

  it('offers no rule without the filter extension', async () => {
    renderWithProviders(
      <EmailAddressMenu address={BOB}>Bob</EmailAddressMenu>,
      {
        withJmapSession: true
      }
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Bob' }))

    expect(
      screen.queryByRole('menuitem', { name: 'Create a rule with this email' })
    ).toBe(null)
  })
})
