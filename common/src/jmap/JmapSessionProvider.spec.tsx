import { useQueryClient } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState, type ReactElement } from 'react'

import {
  FAKE_ACCOUNT_ID,
  FAKE_SESSION_URL,
  FAKE_USERNAME,
  makeFakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { useJmapClient } from './JmapClientProvider'
import {
  JmapSessionProvider,
  useJmapSession,
  useMailboxView
} from './JmapSessionProvider'
import { OWN_VIEW, writeMailboxView } from './mailboxView'
import { SHARES_CAPABILITY } from './queries'

function SessionSummary(): ReactElement {
  const { session, accountId } = useJmapSession()
  return (
    <p>
      {session.username} / {accountId}
    </p>
  )
}

describe('JmapSessionProvider', () => {
  it('renders the mail screens once the session is loaded', async () => {
    renderWithProviders(
      <JmapSessionProvider>
        <SessionSummary />
      </JmapSessionProvider>
    )

    expect(screen.getByTestId('full-page-loader')).toBeInTheDocument()
    expect(
      await screen.findByText(`${FAKE_USERNAME} / ${FAKE_ACCOUNT_ID}`)
    ).toBeVisible()
  })

  it('lets the user retry when the session cannot be fetched', async () => {
    const server = makeFakeJmapServer()
    const fetchSession = server.fetch
    let available = false
    server.fetch = (input, init) =>
      input === FAKE_SESSION_URL && !available
        ? Promise.resolve(new Response('Unavailable', { status: 503 }))
        : fetchSession(input, init)
    renderWithProviders(
      <JmapSessionProvider>
        <SessionSummary />
      </JmapSessionProvider>,
      { jmapServer: server }
    )

    const retryButton = await screen.findByTestId('session-error-action')
    // The whole page: its main landmark, under a level-1 title
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { level: 1 })
    )
    available = true
    await userEvent.click(retryButton)

    expect(
      await screen.findByText(`${FAKE_USERNAME} / ${FAKE_ACCOUNT_ID}`)
    ).toBeVisible()
  })

  it('sends the team mailbox capability in every request of the mail screens', async () => {
    const server = makeFakeJmapServer({
      capabilities: { [SHARES_CAPABILITY]: {} }
    })
    function Mailboxes(): ReactElement {
      const client = useJmapClient()
      const { accountId } = useJmapSession()
      const [count, setCount] = useState<number | null>(null)
      useEffect(() => {
        void client
          .call('Mailbox/get', { accountId, ids: null })
          .then(response => {
            setCount(response.list.length)
          })
      }, [client, accountId])
      return <p>{count === null ? 'Loading' : `${count} mailboxes`}</p>
    }
    renderWithProviders(
      <JmapSessionProvider>
        <Mailboxes />
      </JmapSessionProvider>,
      { jmapServer: server }
    )

    expect(await screen.findByText(/mailboxes$/)).toBeVisible()
    expect(server.requests[0]?.using).toContain(SHARES_CAPABILITY)
  })
})

describe('JmapSessionProvider mailbox view', () => {
  const DELEGATED_ID = 'account-delegated'

  function ViewSummary(): ReactElement {
    const { accountId, ownAccountId, mailAddress } = useJmapSession()
    const { switchView } = useMailboxView()
    const queryClient = useQueryClient()
    // A query of the screens, cached under its account
    useEffect(() => {
      queryClient.setQueryData(['mailbox', accountId, 'list'], { list: [] })
    }, [queryClient, accountId])
    return (
      <>
        <p>
          {accountId} / {ownAccountId} / {mailAddress}
        </p>
        <button
          type="button"
          onClick={() => {
            switchView({ kind: 'delegated', accountId: DELEGATED_ID })
          }}
        >
          Delegated
        </button>
        <button
          type="button"
          onClick={() => {
            switchView(OWN_VIEW)
          }}
        >
          Own
        </button>
      </>
    )
  }

  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('shows a mailbox delegated to the user, then theirs, with a cache emptied each time', async () => {
    const server = makeFakeJmapServer({
      delegatedAccounts: [{ accountId: DELEGATED_ID, name: 'boss@example.com' }]
    })
    const { queryClient } = renderWithProviders(
      <JmapSessionProvider>
        <ViewSummary />
      </JmapSessionProvider>,
      { jmapServer: server }
    )

    expect(
      await screen.findByText(
        `${FAKE_ACCOUNT_ID} / ${FAKE_ACCOUNT_ID} / ${FAKE_USERNAME}`
      )
    ).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Delegated' }))

    expect(
      await screen.findByText(
        `${DELEGATED_ID} / ${FAKE_ACCOUNT_ID} / boss@example.com`
      )
    ).toBeVisible()
    // The data of the previous mailbox is gone, the session is kept
    expect(queryClient.getQueryData(['mailbox', FAKE_ACCOUNT_ID, 'list'])).toBe(
      undefined
    )
    expect(queryClient.getQueryData(['jmap', 'session'])).not.toBe(undefined)

    await userEvent.click(screen.getByRole('button', { name: 'Own' }))
    expect(
      await screen.findByText(
        `${FAKE_ACCOUNT_ID} / ${FAKE_ACCOUNT_ID} / ${FAKE_USERNAME}`
      )
    ).toBeVisible()
    expect(queryClient.getQueryData(['mailbox', DELEGATED_ID, 'list'])).toBe(
      undefined
    )
  })

  it('keeps the view of the tab through a reload, while the delegation lasts', async () => {
    writeMailboxView(FAKE_USERNAME, {
      kind: 'delegated',
      accountId: DELEGATED_ID
    })
    const server = makeFakeJmapServer({
      delegatedAccounts: [{ accountId: DELEGATED_ID, name: 'boss@example.com' }]
    })
    renderWithProviders(
      <JmapSessionProvider>
        <ViewSummary />
      </JmapSessionProvider>,
      { jmapServer: server }
    )

    expect(
      await screen.findByText(
        `${DELEGATED_ID} / ${FAKE_ACCOUNT_ID} / boss@example.com`
      )
    ).toBeVisible()
  })

  it('gives the user their own mailbox back once the delegation is gone', async () => {
    writeMailboxView(FAKE_USERNAME, {
      kind: 'delegated',
      accountId: DELEGATED_ID
    })
    renderWithProviders(
      <JmapSessionProvider>
        <ViewSummary />
      </JmapSessionProvider>
    )

    expect(
      await screen.findByText(
        `${FAKE_ACCOUNT_ID} / ${FAKE_ACCOUNT_ID} / ${FAKE_USERNAME}`
      )
    ).toBeVisible()
  })
})
