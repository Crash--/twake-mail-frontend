import { VirtuosoMockContext } from '@linagora/twake-mui'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Outlet, Route, useParams } from 'react-router'

import { MailboxTree } from '@common/features/mailbox/MailboxTree'
import { EmailList } from '@common/features/thread/EmailList'
import {
  makeEmailWithBody,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EmailView } from './EmailView'

function MailScreen(): ReactElement {
  return (
    <VirtuosoMockContext.Provider
      value={{ viewportHeight: 10_000, itemHeight: 56 }}
    >
      <MailboxTree />
      <Outlet />
    </VirtuosoMockContext.Provider>
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
      emailId={emailId}
      backPath={`/mailbox/${encodeURIComponent(mailboxId)}`}
    />
  )
}

function renderMailScreen(server: FakeJmapServer): void {
  renderWithProviders(<MailScreen />, {
    route: '/mailbox/mailbox-inbox',
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

function inboxUnreadCount(): string | null {
  const inbox = screen
    .getAllByTestId('mailbox-item')
    .find(item => item.getAttribute('data-mailbox-role') === 'inbox')
  if (!inbox) throw new Error('No inbox in the tree')
  return (
    within(inbox).queryByTestId('mailbox-unread-count')?.textContent ?? null
  )
}

function makeServer(): FakeJmapServer {
  return makeFakeJmapServer({
    emails: [
      makeEmailWithBody(
        { id: 'e1', subject: 'Unread news', keywords: {} },
        { text: 'Hello' }
      )
    ]
  })
}

async function openUnreadEmail(): Promise<void> {
  await userEvent.click(await screen.findByText('Unread news'))
  await screen.findByTestId('email-view-subject')
}

describe('Marking an email as read when it is opened', () => {
  it('updates the counter and the list before the server answers', async () => {
    const server = makeServer()
    const release = server.holdRequests('Email/set')
    renderMailScreen(server)
    expect(await screen.findByTestId('email-list-item')).toHaveAttribute(
      'data-unread',
      'true'
    )
    expect(inboxUnreadCount()).toBe('2')

    await openUnreadEmail()

    await waitFor(() => {
      expect(inboxUnreadCount()).toBe('1')
    })
    expect(server.calledMethods()).toContain('Email/set')
    await userEvent.click(screen.getByTestId('email-view-back-button'))
    expect(screen.getByTestId('email-list-item')).not.toHaveAttribute(
      'data-unread'
    )

    release()

    await waitFor(() => {
      expect(server.emails[0]?.keywords).toEqual({ $seen: true })
    })
    expect(inboxUnreadCount()).toBe('1')
  })

  it('rolls the update back when the server refuses it', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const server = makeServer()
    server.methodErrors.set('Email/set', 'serverFail')
    renderMailScreen(server)

    await openUnreadEmail()
    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        '[email] Cannot update the keywords',
        expect.anything()
      )
    })

    expect(inboxUnreadCount()).toBe('2')
    await userEvent.click(screen.getByTestId('email-view-back-button'))
    expect(await screen.findByTestId('email-list-item')).toHaveAttribute(
      'data-unread',
      'true'
    )
  })
})
