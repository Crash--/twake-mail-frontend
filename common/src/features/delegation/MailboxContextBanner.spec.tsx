import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { writeMailboxView, type MailboxView } from '@common/jmap/mailboxView'
import {
  FAKE_USERNAME,
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeTeamMailboxes,
  type FakeContact
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { MailboxContextBanner } from './MailboxContextBanner'

const BOSS: FakeContact = {
  id: 'c1',
  firstname: 'Boss',
  surname: 'QA',
  emailAddress: 'boss@example.com'
}

function ShownMailbox(): ReactElement {
  const { mailAddress } = useJmapSession()
  return <p>Viewing {mailAddress}</p>
}

function setup(view: MailboxView): void {
  writeMailboxView(FAKE_USERNAME, view)
  const server = makeFakeJmapServer({
    capabilities: {
      'com:linagora:params:jmap:contact:autocomplete': { minInputLength: 1 }
    },
    mailboxes: [...makeDefaultMailboxes(), ...makeTeamMailboxes()],
    delegatedAccounts: [{ accountId: 'account-boss', name: BOSS.emailAddress }],
    contacts: [BOSS]
  })
  renderWithProviders(
    <>
      <MailboxContextBanner />
      <ShownMailbox />
    </>,
    { jmapServer: server, withJmapSession: true }
  )
}

describe('MailboxContextBanner', () => {
  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('is not shown in the user own mailbox', async () => {
    setup({ kind: 'own' })

    expect(
      await screen.findByText(`Viewing ${FAKE_USERNAME}`)
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByTestId('mailbox-context-banner')).toBe(null)
    })
  })

  it('names the owner of a delegated mailbox, without announcing it, and goes back to the user one', async () => {
    setup({ kind: 'delegated', accountId: 'account-boss' })

    const banner = await screen.findByTestId('mailbox-context-banner')
    await waitFor(() => {
      expect(banner).toHaveTextContent(
        'You are in the mailbox of Boss QA (boss@example.com). Emails you send from here go out as Boss QA.'
      )
    })
    expect(banner).toHaveAttribute('role', 'note')

    await userEvent.click(
      screen.getByRole('button', { name: 'Back to your mailbox' })
    )

    expect(
      await screen.findByText(`Viewing ${FAKE_USERNAME}`)
    ).toBeInTheDocument()
    expect(screen.queryByTestId('mailbox-context-banner')).toBe(null)
  })

  it('names the team mailbox picked in the switcher', async () => {
    setup({ kind: 'team', rootId: 'team' })

    expect(
      await screen.findByTestId('mailbox-context-banner')
    ).toHaveTextContent(
      'You are in the team mailbox team (team@example.com). Emails you send from here go out from this address.'
    )
  })
})
