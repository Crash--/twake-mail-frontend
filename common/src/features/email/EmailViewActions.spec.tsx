import { VirtuosoMockContext } from '@linagora/twake-mui'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Outlet, Route, useParams } from 'react-router'

import { MailboxPickerProvider } from '@common/features/mailbox/MailboxPickerProvider'
import { EmailList } from '@common/features/thread/EmailList'
import {
  makeDefaultMailboxes,
  makeEmailWithBody,
  makeFakeJmapServer,
  makeMailbox,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EmailView } from './EmailView'

function MailScreen(): ReactElement {
  return (
    <MailboxPickerProvider>
      <VirtuosoMockContext.Provider
        value={{ viewportHeight: 10_000, itemHeight: 56 }}
      >
        <Outlet />
      </VirtuosoMockContext.Provider>
    </MailboxPickerProvider>
  )
}

function ListPage(): ReactElement {
  const { mailboxId = '' } = useParams()
  return <EmailList mailboxId={mailboxId} />
}

function ViewPage(): ReactElement {
  const { mailboxId = '', emailId = '' } = useParams()
  return (
    <EmailView
      mailboxId={mailboxId}
      emailId={emailId}
      backPath={`/mailbox/${mailboxId}`}
    />
  )
}

function makeServer(): FakeJmapServer {
  return makeFakeJmapServer({
    mailboxes: [
      ...makeDefaultMailboxes(),
      makeMailbox({ id: 'mailbox-archive', name: 'Archive', role: 'archive' }),
      makeMailbox({ id: 'templates', name: 'Templates' })
    ],
    emails: [
      makeEmailWithBody(
        { id: 'e1', subject: 'Open me', keywords: { $seen: true } },
        { text: 'Hello' }
      )
    ]
  })
}

async function openEmail(server: FakeJmapServer): Promise<void> {
  renderWithProviders(<MailScreen />, {
    route: '/mailbox/mailbox-inbox/email/e1',
    path: '/',
    withJmapSession: true,
    jmapServer: server,
    childRoutes: (
      <>
        <Route path="mailbox/:mailboxId" element={<ListPage />} />
        <Route
          path="mailbox/:mailboxId/email/:emailId"
          element={<ViewPage />}
        />
      </>
    )
  })
  await screen.findByTestId('email-view-subject')
}

describe('EmailViewActions', () => {
  afterEach(() => {
    resetViewport()
  })

  it('archives the open email from its button, then shows the list', async () => {
    const server = makeServer()
    await openEmail(server)

    await userEvent.click(
      screen.getByRole('button', { name: 'Archive message' })
    )

    expect(await screen.findByTestId('empty-thread-view')).toBeVisible()
    expect(server.emails[0]?.mailboxIds).toEqual({ 'mailbox-archive': true })
  })

  it('stars and unstars it, the button saying its state', async () => {
    const server = makeServer()
    await openEmail(server)
    const star = screen.getByTestId('email-view-star-button')
    expect(star).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(star)
    await waitFor(() => {
      expect(star).toHaveAttribute('aria-pressed', 'true')
    })
    expect(star).toHaveAccessibleName('Unstar')
    await waitFor(() => {
      expect(server.emails[0]?.keywords).toEqual({
        $seen: true,
        $flagged: true
      })
    })
  })

  it('offers every action in "More" on a phone; unread closes the email', async () => {
    mockViewport({ width: 390, touch: true })
    const server = makeServer()
    await openEmail(server)

    expect(screen.queryByRole('button', { name: 'Archive message' })).toBe(null)
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    const menu = screen.getByRole('menu', { name: 'Message actions' })
    expect(
      within(menu).getByRole('menuitem', { name: 'Move to trash' })
    ).toBeVisible()
    await userEvent.click(
      within(menu).getByRole('menuitem', { name: 'Mark as unread' })
    )

    expect(await screen.findByTestId('email-list-item')).toHaveAttribute(
      'data-unread',
      'true'
    )
    expect(screen.queryByTestId('email-view')).toBe(null)
  })

  it('moves it to the folder picked', async () => {
    const server = makeServer()
    await openEmail(server)

    await userEvent.click(screen.getByRole('button', { name: 'Move message' }))
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'Move To' })).getByRole(
        'option',
        { name: 'Templates' }
      )
    )

    expect(await screen.findByTestId('empty-thread-view')).toBeVisible()
    expect(server.emails[0]?.mailboxIds).toEqual({ templates: true })
  })
})
