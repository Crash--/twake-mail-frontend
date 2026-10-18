import { VirtuosoMockContext } from '@linagora/twake-mui'
import type { QueryClient } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Outlet, Route, useParams } from 'react-router'

import { EmailView } from '@common/features/email/EmailView'
import { MailboxTree } from '@common/features/mailbox/MailboxTree'
import {
  FAKE_ACCOUNT_ID,
  makeEmailWithBody,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'

import { EmailList } from './EmailList'
import { EmailSelectionMemoryProvider } from './EmailSelectionMemoryProvider'
import { threadKeys } from './queries'

/** The open email replaces the list, as on phones and small tablets */
function MailScreen(): ReactElement {
  return (
    <EmailSelectionMemoryProvider>
      <VirtuosoMockContext.Provider
        value={{ viewportHeight: 10_000, itemHeight: 56 }}
      >
        <MailboxTree />
        <Outlet />
      </VirtuosoMockContext.Provider>
    </EmailSelectionMemoryProvider>
  )
}

function ListPage(): ReactElement {
  const { mailboxId = '' } = useParams()
  return <EmailList key={mailboxId} mailboxId={mailboxId} />
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

function renderMailScreen(server: FakeJmapServer): QueryClient {
  return renderWithProviders(<MailScreen />, {
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
  }).queryClient
}

function makeServer(): FakeJmapServer {
  return makeFakeJmapServer({
    emails: ['First', 'Second', 'Third'].map((subject, index) =>
      makeEmailWithBody(
        {
          id: `e${index}`,
          subject,
          receivedAt: `2026-10-0${3 - index}T08:00:00Z`,
          keywords: { $seen: true }
        },
        { text: `Body of ${subject}` }
      )
    )
  })
}

function selectBox(subject: string): HTMLElement {
  return screen.getByRole('checkbox', { name: `Select ${subject}` })
}

/**
 * Selects the last two: the first row is opened, the list comes back on it
 * (a row further down would scroll, which the mocked table does not do)
 */
async function selectLastTwo(): Promise<void> {
  await screen.findByText('Third')
  await userEvent.click(selectBox('Second'))
  await userEvent.click(selectBox('Third'))
  await screen.findByTestId('selection-toolbar')
}

function folderLink(name: string): HTMLElement {
  return within(
    screen.getByRole('treeitem', { name: new RegExp(name) })
  ).getByRole('link')
}

async function openAndGoBack(subject: string): Promise<void> {
  await userEvent.click(screen.getByText(subject))
  await screen.findByTestId('email-view-subject', {}, { timeout: 5000 })
  await userEvent.click(screen.getByTestId('email-view-back-button'))
  await screen.findByText('First', {}, { timeout: 5000 })
}

describe('EmailSelectionMemoryProvider', () => {
  jest.setTimeout(30_000)
  listEmailsOneByOne()

  it('keeps the selection while an email opened from the list is shown', async () => {
    renderMailScreen(makeServer())
    await selectLastTwo()

    await openAndGoBack('First')

    expect(selectBox('First')).not.toBeChecked()
    expect(selectBox('Second')).toBeChecked()
    expect(selectBox('Third')).toBeChecked()
    expect(screen.getByTestId('selection-toolbar-count')).toHaveTextContent('2')
  })

  it('drops the emails that left the list meanwhile', async () => {
    const server = makeServer()
    const queryClient = renderMailScreen(server)
    await selectLastTwo()
    await userEvent.click(screen.getByText('First'))
    await screen.findByTestId('email-view-subject', {}, { timeout: 5000 })

    // Gone elsewhere: the list is read again when shown (no push here)
    server.destroyEmail('e1')
    await queryClient.invalidateQueries({
      queryKey: threadKeys.all(FAKE_ACCOUNT_ID)
    })
    await userEvent.click(screen.getByTestId('email-view-back-button'))
    await screen.findByText('First', {}, { timeout: 5000 })
    await waitFor(() => {
      expect(screen.queryByText('Second')).toBe(null)
    })

    expect(selectBox('Third')).toBeChecked()
    expect(screen.getByTestId('selection-toolbar-count')).toHaveTextContent('1')
  })

  it('forgets the selection once another folder is shown', async () => {
    renderMailScreen(makeServer())
    await selectLastTwo()

    await userEvent.click(folderLink('Sent'))
    await waitFor(
      () => {
        expect(screen.queryByText('First')).toBe(null)
      },
      { timeout: 5000 }
    )
    await userEvent.click(folderLink('Inbox'))
    await screen.findByText('First', {}, { timeout: 5000 })

    expect(selectBox('First')).not.toBeChecked()
    expect(selectBox('Second')).not.toBeChecked()
    expect(screen.queryByTestId('selection-toolbar')).toBe(null)
  })
})
