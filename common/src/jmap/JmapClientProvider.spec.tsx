import { screen } from '@testing-library/react'
import type { ReactElement } from 'react'

import { createBasicAuthService } from '@common/features/auth/basicAuth'
import {
  FAKE_SESSION_URL,
  FAKE_USERNAME,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { useJmapSession } from './JmapSessionProvider'

function Username(): ReactElement {
  return <p>{useJmapSession().session.username}</p>
}

/** Counts the reads of the session resource the server receives */
function countSessionReads(server: FakeJmapServer): () => number {
  const fetchFromServer = server.fetch
  let reads = 0
  server.fetch = (input, init) => {
    if (input === FAKE_SESSION_URL) reads += 1
    return fetchFromServer(input, init)
  }
  return () => reads
}

describe('JmapClientProvider', () => {
  it('reads the session once for a basic sign-in and its first screen', async () => {
    const server = makeFakeJmapServer()
    const sessionReads = countSessionReads(server)
    const authService = createBasicAuthService(
      { jmapSessionUrl: FAKE_SESSION_URL },
      { fetch: server.fetch, sessionSharing: null }
    )
    await authService.login('alice@example.com', 'secret')

    renderWithProviders(<Username />, {
      authService,
      jmapServer: server,
      withJmapSession: true
    })

    expect(await screen.findByText(FAKE_USERNAME)).toBeVisible()
    expect(sessionReads()).toBe(1)
  })

  it('fetches the session when the sign-in did not read it', async () => {
    const server = makeFakeJmapServer()
    const sessionReads = countSessionReads(server)

    renderWithProviders(<Username />, {
      jmapServer: server,
      withJmapSession: true
    })

    expect(await screen.findByText(FAKE_USERNAME)).toBeVisible()
    expect(sessionReads()).toBe(1)
  })
})
