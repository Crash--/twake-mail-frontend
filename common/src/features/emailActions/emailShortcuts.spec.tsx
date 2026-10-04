import { VirtuosoMockContext } from '@linagora/twake-mui'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Outlet, Route, useParams } from 'react-router'

import { EmailView } from '@common/features/email/EmailView'
import { ShortcutsProvider } from '@common/features/shortcuts/ShortcutsProvider'
import { EmailList } from '@common/features/thread/EmailList'
import {
  makeDefaultMailboxes,
  makeEmailWithBody,
  makeFakeJmapServer,
  makeMailbox,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'

function MailScreen(): ReactElement {
  return (
    <ShortcutsProvider>
      <VirtuosoMockContext.Provider
        value={{ viewportHeight: 10_000, itemHeight: 56 }}
      >
        <Outlet />
      </VirtuosoMockContext.Provider>
    </ShortcutsProvider>
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
      makeMailbox({ id: 'mailbox-archive', name: 'Archive', role: 'archive' })
    ],
    emails: ['First', 'Second', 'Third'].map((subject, index) =>
      makeEmailWithBody(
        {
          id: `e${index + 1}`,
          subject,
          keywords: { $seen: true },
          receivedAt: `2026-10-0${3 - index}T08:00:00Z`
        },
        { text: `${subject} body` }
      )
    )
  })
}

function renderMailScreen(server: FakeJmapServer, route: string): void {
  renderWithProviders(<MailScreen />, {
    route,
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
}

function row(subject: string): HTMLElement {
  const found = screen
    .getAllByTestId('email-list-item')
    .find(
      item =>
        within(item).getByTestId('email-list-item-subject').textContent ===
        subject
    )
  if (!found) throw new Error(`No row ${subject}`)
  return found
}

function rowLink(subject: string): HTMLElement {
  return within(row(subject)).getByRole('link')
}

describe('Email keyboard shortcuts', () => {
  listEmailsOneByOne()

  it('moves between the rows and archives the focused one', async () => {
    const server = makeServer()
    renderMailScreen(server, '/mailbox/mailbox-inbox')
    await screen.findByText('First')
    rowLink('First').focus()

    await userEvent.keyboard('j')
    expect(rowLink('Second')).toHaveFocus()
    await userEvent.keyboard('k')
    expect(rowLink('First')).toHaveFocus()

    await userEvent.keyboard('e')

    await waitFor(() => {
      expect(screen.queryByText('First')).toBe(null)
    })
    expect(rowLink('Second')).toHaveFocus()
    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Moved to Archive'
    )
    expect(server.emails.find(email => email.id === 'e1')?.mailboxIds).toEqual({
      'mailbox-archive': true
    })
  })

  it('asks before deleting forever from the Trash', async () => {
    const server = makeServer()
    server.emails.forEach(email => {
      email.mailboxIds = { 'mailbox-trash': true }
    })
    renderMailScreen(server, '/mailbox/mailbox-trash')
    await screen.findByText('First')
    rowLink('First').focus()

    await userEvent.keyboard('#')

    const dialog = await screen.findByRole('dialog', {
      name: 'Delete message forever'
    })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )

    await waitFor(() => {
      expect(server.emails.map(email => email.id)).toEqual(['e2', 'e3'])
    })
  })

  it('archives the open email and goes back to the list, on the next row', async () => {
    const server = makeServer()
    renderMailScreen(server, '/mailbox/mailbox-inbox/email/e1')
    await screen.findByTestId('email-view-subject')

    await userEvent.keyboard('e')

    // The first row: virtuoso does not render a list scrolled to another
    // row without layout (jsdom)
    expect(await screen.findByText('Second')).toBeVisible()
    expect(screen.queryByTestId('email-view')).toBe(null)
    expect(screen.queryByText('First')).toBe(null)
    await waitFor(() => {
      expect(rowLink('Second')).toHaveFocus()
    })
  })

  it('opens the next and the previous email of the folder', async () => {
    const server = makeServer()
    renderMailScreen(server, '/mailbox/mailbox-inbox/email/e2')
    await screen.findByTestId('email-view-subject')

    await userEvent.keyboard('j')
    expect(await screen.findByTestId('email-view-subject')).toHaveTextContent(
      'Third'
    )
    await userEvent.keyboard('k')
    await waitFor(() => {
      expect(screen.getByTestId('email-view-subject')).toHaveTextContent(
        'Second'
      )
    })
  })
})
