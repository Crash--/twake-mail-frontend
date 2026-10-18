import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createClient } from 'jmap-client-ts'
import { isValidElement, type ReactElement } from 'react'
import {
  createRoutesFromElements,
  MemoryRouter,
  Routes,
  useLocation
} from 'react-router'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { AppProviders } from '@common/app/AppProviders'
import { makeQueryClient } from '@common/app/queryClient'
import { AuthProvider } from '@common/features/auth/AuthProvider'
import { TeamMailboxEmbedProvider } from '@common/features/teamMailboxEmbed/TeamMailboxEmbedContext'
import { JmapClientProvider } from '@common/jmap/JmapClientProvider'
import { TeamMailboxErrorPane } from '@common/layout/TeamMailboxErrorPane'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'
import {
  FAKE_SESSION_URL,
  makeDefaultMailboxes,
  makeEmail,
  makeFakeJmapServer,
  makeTeamMailboxes,
  type FakeEmail
} from '@common/testing/fakeJmapServer'
import { makeFakeBasicAuthService } from '@common/testing/makeFakeAuthService'

import { teamMailboxEmbedRouteElements } from './TeamMailboxEmbedRoutes'

const BASE = '/embed/team-mailboxes/team'

function LocationProbe(): ReactElement {
  return <output data-testid="location">{useLocation().pathname}</output>
}

function renderRoutes(
  path: string,
  rootId = 'team',
  emails: FakeEmail[] = [],
  isSessionAvailable = true
): void {
  const jmapServer = makeFakeJmapServer({
    emails,
    mailboxes: [
      ...makeDefaultMailboxes(),
      ...makeTeamMailboxes({ id: 'team', address: 'team@example.com' }),
      ...makeTeamMailboxes({ id: 'sales', address: 'sales@example.com' })
    ]
  })
  if (!isSessionAvailable) {
    jmapServer.fetch = () =>
      Promise.resolve(new Response('Unavailable', { status: 500 }))
  }
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
  afterEach(resetViewport)

  it('opens the Inbox of the team mailbox, without the frame of the webmail', async () => {
    renderRoutes(`${BASE}/`)

    // The first render of the facade in this file is cold (styles, routes,
    // session, folders and list): over the default 1 s on a busy CI runner
    expect(
      await screen.findByTestId('mailbox-page', {}, { timeout: 3000 })
    ).toHaveAttribute('data-mailbox-id', 'team-inbox')
    expect(
      await within(screen.getByTestId('list-toolbar')).findByRole('button', {
        name: 'Compose'
      })
    ).toHaveAttribute('data-testid', 'compose-email-button')
    expect(screen.queryByTestId('sidebar')).toBe(null)
    expect(screen.queryByTestId('mailbox-tree')).toBe(null)
    expect(screen.queryByTestId('top-bar')).toBe(null)
  })

  it('puts the focus in the main content, as the webmail after signing in', async () => {
    renderRoutes(`${BASE}/`)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Inbox' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('main-content')).toHaveFocus()
  })

  it('offers a new message in a floating button on a phone, where the list has no toolbar', async () => {
    mockViewport({ width: 390, touch: true })
    renderRoutes(`${BASE}/`)

    await screen.findByTestId('mailbox-page')
    expect(
      await screen.findByRole('button', { name: 'Compose' })
    ).toHaveAttribute('data-testid', 'compose-email-button')
    expect(screen.getAllByTestId('compose-email-button')).toHaveLength(1)
    expect(screen.queryByTestId('list-toolbar')).toBe(null)
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

  it('names the page and focuses its heading when the team mailbox is not available', async () => {
    renderRoutes(`${BASE}/`, 'other')

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'This team mailbox is not available'
    })
    expect(heading).toHaveFocus()
    await waitFor(() => {
      expect(document.title).toBe(
        'This team mailbox is not available - Twake Mail'
      )
    })
  })

  it('offers no new message when the user is not a member of the team mailbox', async () => {
    const user = userEvent.setup()
    renderRoutes(`${BASE}/`, 'other')
    await screen.findByTestId('team-mailbox-unavailable')

    expect(screen.queryByTestId('compose-email-button')).toBe(null)
    await user.keyboard('c')
    expect(screen.queryByRole('dialog')).toBe(null)
  })

  it('opens an email of the team mailbox', async () => {
    renderRoutes(`${BASE}/mailbox/team-inbox/email/shared`, 'team', [
      makeEmail({ id: 'shared', mailboxIds: { 'team-inbox': true } })
    ])

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Subject shared' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/mailbox/team-inbox/email/shared'
    )
  })

  // Declarative `<Routes>` ignore `errorElement`: the tree says where it goes
  it('shows a page that failed to render in the pane of the facade', () => {
    const [root] = createRoutesFromElements(teamMailboxEmbedRouteElements())
    const errorElement = root?.errorElement
    expect(isValidElement(errorElement) && errorElement.type).toBe(
      TeamMailboxErrorPane
    )
  })

  it('shows a session that cannot load in the pane of the facade, with the focus on Retry', async () => {
    renderRoutes(`${BASE}/`, 'team', [], false)

    const retryButton = await screen.findByTestId('session-error-action')
    expect(screen.getByTestId('team-mailbox-error-pane')).toContainElement(
      retryButton
    )
    expect(retryButton).toHaveFocus()
    // The pane is the main landmark: the error has none of its own
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { level: 1 })
    )
    await waitFor(() => {
      expect(document.title).toBe('Connection error - Twake Mail')
    })
  })

  it.each(['team-inbox', 'team-trash'])(
    'opens the Inbox of the team mailbox instead of a personal email under %s',
    async folderId => {
      renderRoutes(`${BASE}/mailbox/${folderId}/email/personal`, 'team', [
        makeEmail({ id: 'personal', mailboxIds: { 'mailbox-inbox': true } })
      ])

      await waitFor(() => {
        expect(screen.getByTestId('location')).toHaveTextContent(
          /\/mailbox\/team-inbox$/
        )
      })
      expect(screen.queryByText('Subject personal')).toBe(null)
    }
  )

  it('opens the Inbox of the team mailbox instead of an email of another team mailbox', async () => {
    renderRoutes(`${BASE}/mailbox/team-inbox/email/sales`, 'team', [
      makeEmail({ id: 'sales', mailboxIds: { 'sales-inbox': true } })
    ])

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        /\/mailbox\/team-inbox$/
      )
    })
    expect(screen.queryByText('Subject sales')).toBe(null)
  })

  it('opens an email by its id, in the folder of the team mailbox that holds it', async () => {
    renderRoutes(`${BASE}/email/archived`, 'team', [
      makeEmail({ id: 'archived', mailboxIds: { 'team-trash': true } })
    ])

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Subject archived' })
    ).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/mailbox/team-trash/email/archived'
    )
  })

  it('skips the folders of the user when an email is in both', async () => {
    renderRoutes(`${BASE}/email/both`, 'team', [
      makeEmail({
        id: 'both',
        mailboxIds: { 'mailbox-inbox': true, 'team-inbox': true }
      })
    ])

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/mailbox/team-inbox/email/both'
      )
    })
  })

  it.each([
    ['a personal email', 'personal', { 'mailbox-inbox': true }],
    ['an email of another team mailbox', 'sales', { 'sales-inbox': true }]
  ] as const)(
    'opens the Inbox of the team mailbox instead of %s found by its id',
    async (_name, id, mailboxIds) => {
      renderRoutes(`${BASE}/email/${id}`, 'team', [
        makeEmail({ id, mailboxIds })
      ])

      await waitFor(() => {
        expect(screen.getByTestId('location')).toHaveTextContent(
          /\/mailbox\/team-inbox$/
        )
      })
      expect(screen.queryByText(`Subject ${id}`)).toBe(null)
    }
  )

  it('opens the Inbox of the team mailbox when the email no longer exists', async () => {
    renderRoutes(`${BASE}/email/gone`)

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        /\/mailbox\/team-inbox$/
      )
    })
  })
})
