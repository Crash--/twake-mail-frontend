import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createClient } from 'jmap-client-ts'
import type { ReactElement } from 'react'
import { MemoryRouter, Routes, useLocation } from 'react-router'

import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'
import { AuthProvider } from '@common/features/auth/AuthProvider'
import { TeamMailboxEmbedProvider } from '@common/features/teamMailboxEmbed/TeamMailboxEmbedContext'
import { JmapClientProvider } from '@common/jmap/JmapClientProvider'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'
import {
  FAKE_SESSION_URL,
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeTeamMailboxes
} from '@common/testing/fakeJmapServer'
import { makeFakeBasicAuthService } from '@common/testing/makeFakeAuthService'

import { teamMailboxEmbedRouteElements } from './TeamMailboxEmbedRoutes'

const BASE = '/embed/team-mailboxes/team'

function LocationProbe(): ReactElement {
  return <output data-testid="location">{useLocation().pathname}</output>
}

function renderRoutes(path: string, rootId = 'team'): void {
  const jmapServer = makeFakeJmapServer({
    mailboxes: [
      ...makeDefaultMailboxes(),
      ...makeTeamMailboxes({ id: 'team', address: 'team@example.com' }),
      ...makeTeamMailboxes({ id: 'sales', address: 'sales@example.com' })
    ]
  })
  const queryClient = makeQueryClient()
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retry: false }
  })

  render(
    <AppProviders lang="en" queryClient={queryClient}>
      <AuthProvider service={makeFakeBasicAuthService()}>
        <JmapClientProvider
          createClient={options =>
            createClient({ ...options, fetch: jmapServer.fetch })
          }
          sessionUrl={FAKE_SESSION_URL}
        >
          <TeamMailboxEmbedProvider rootId={rootId}>
            <MemoryRouter basename={BASE} initialEntries={[path]}>
              <LocationProbe />
              <Routes>{teamMailboxEmbedRouteElements()}</Routes>
            </MemoryRouter>
          </TeamMailboxEmbedProvider>
        </JmapClientProvider>
      </AuthProvider>
    </AppProviders>
  )
}

describe('teamMailboxEmbedRouteElements', () => {
  listEmailsOneByOne()

  it('opens the Inbox of the team mailbox, without the frame of the webmail', async () => {
    renderRoutes(`${BASE}/`)

    expect(await screen.findByTestId('mailbox-page')).toHaveAttribute(
      'data-mailbox-id',
      'team-inbox'
    )
    expect(screen.getByTestId('compose-email-button')).toBeInTheDocument()
    expect(screen.queryByTestId('sidebar')).toBe(null)
    expect(screen.queryByTestId('mailbox-tree')).toBe(null)
    expect(screen.queryByTestId('top-bar')).toBe(null)
  })

  it('opens the Inbox of the team mailbox instead of a folder of the user', async () => {
    renderRoutes(`${BASE}/mailbox/mailbox-inbox`)

    await waitFor(() => {
      expect(screen.getByTestId('mailbox-page')).toHaveAttribute(
        'data-mailbox-id',
        'team-inbox'
      )
    })
  })

  it('opens the Inbox of the team mailbox instead of a page of the webmail', async () => {
    renderRoutes(`${BASE}/settings/profiles`)

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/mailbox/team-inbox'
      )
    })
  })

  it('opens the Inbox of the team mailbox instead of a folder of another team mailbox', async () => {
    renderRoutes(`${BASE}/mailbox/sales-inbox`)

    await waitFor(() => {
      expect(screen.getByTestId('mailbox-page')).toHaveAttribute(
        'data-mailbox-id',
        'team-inbox'
      )
    })
  })

  it('says so when the user is not a member of the team mailbox', async () => {
    renderRoutes(`${BASE}/`, 'other')

    expect(
      await screen.findByTestId('team-mailbox-unavailable')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('mailbox-page')).toBe(null)
  })

  it('offers no new message when the user is not a member of the team mailbox', async () => {
    const user = userEvent.setup()
    renderRoutes(`${BASE}/`, 'other')
    await screen.findByTestId('team-mailbox-unavailable')

    expect(screen.queryByTestId('compose-email-button')).toBe(null)
    await user.keyboard('c')
    expect(screen.queryByRole('dialog')).toBe(null)
  })
})
