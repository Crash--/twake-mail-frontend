import { useQueryClient } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { writeMailboxView } from '@common/jmap/mailboxView'
import { reloadSession } from '@common/jmap/queries'
import { FAKE_DELEGATION_CAPABILITIES } from '@common/testing/fakeDelegation'
import {
  FAKE_USERNAME,
  makeFakeJmapServer,
  type FakeContact
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { DelegatedAccessGuard } from './DelegatedAccessGuard'

const DELEGATED_ID = 'account-alice'

const ALICE: FakeContact = {
  id: 'c1',
  firstname: 'Alice',
  surname: 'QA',
  emailAddress: 'alice@example.com'
}

function ReloadSession(): ReactElement {
  const client = useJmapClient()
  const queryClient = useQueryClient()
  const { mailAddress } = useJmapSession()
  return (
    <>
      <p>Viewing {mailAddress}</p>
      <button
        type="button"
        onClick={() => {
          void reloadSession(client, queryClient)
        }}
      >
        Reload session
      </button>
    </>
  )
}

/** The delegated mailbox shown, then taken back */
async function setup(contacts: FakeContact[]): Promise<void> {
  writeMailboxView(FAKE_USERNAME, {
    kind: 'delegated',
    accountId: DELEGATED_ID
  })
  const server = makeFakeJmapServer({
    capabilities: {
      ...FAKE_DELEGATION_CAPABILITIES,
      'com:linagora:params:jmap:contact:autocomplete': { minInputLength: 1 }
    },
    delegatedAccounts: [{ accountId: DELEGATED_ID, name: ALICE.emailAddress }],
    contacts
  })
  renderWithProviders(
    <>
      <DelegatedAccessGuard />
      <ReloadSession />
    </>,
    { jmapServer: server, withJmapSession: true }
  )
  expect(await screen.findByText(`Viewing ${ALICE.emailAddress}`)).toBeVisible()
  server.delegatedAccounts = []
  await userEvent.click(screen.getByRole('button', { name: 'Reload session' }))
}

describe('DelegatedAccessGuard', () => {
  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('names the owner of a delegation taken back as the mailbox switcher does (#709)', async () => {
    await setup([ALICE])

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You no longer have access to the mailbox of Alice QA'
    )
  })

  it('names them by their address when no contact has a name for it', async () => {
    await setup([])

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You no longer have access to the mailbox of alice@example.com'
    )
  })
})
