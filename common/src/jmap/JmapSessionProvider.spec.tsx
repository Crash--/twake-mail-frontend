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
import { JmapSessionProvider, useJmapSession } from './JmapSessionProvider'
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
