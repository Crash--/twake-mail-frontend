import { VirtuosoMockContext } from '@linagora/twake-mui'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { FolderActionsProvider } from '@common/features/mailboxActions/FolderActionsProvider'
import {
  SPAM_REPORT_INTERVAL_MS,
  SPAM_REPORT_PREFERENCE_STORAGE_KEY
} from '@common/features/settings/spamReportPreference'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'
import {
  makeDefaultMailboxes,
  makeEmail,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EmailList } from './EmailList'

function makeServer(unreadSpam = 3): FakeJmapServer {
  return makeFakeJmapServer({
    mailboxes: makeDefaultMailboxes().map(mailbox =>
      mailbox.id === 'mailbox-spam'
        ? { ...mailbox, unreadEmails: unreadSpam, totalEmails: unreadSpam }
        : mailbox
    ),
    emails: [
      makeEmail({ id: 'a', mailboxIds: { 'mailbox-inbox': true } }),
      makeEmail({ id: 's', mailboxIds: { 'mailbox-spam': true } })
    ]
  })
}

async function renderFolder(
  server: FakeJmapServer,
  mailboxId: string
): Promise<{ unmount: () => void }> {
  const { unmount } = renderWithProviders(
    <VirtuosoMockContext.Provider
      value={{ viewportHeight: 10_000, itemHeight: 56 }}
    >
      <FolderActionsProvider>
        <EmailList mailboxId={mailboxId} />
      </FolderActionsProvider>
    </VirtuosoMockContext.Provider>,
    {
      route: `/mailbox/${mailboxId}`,
      path: '/mailbox/:mailboxId',
      withJmapSession: true,
      jmapServer: server
    }
  )
  await screen.findAllByTestId('email-list-item')
  return { unmount }
}

describe('SpamReportBanner', () => {
  listEmailsOneByOne()
  afterEach(() => {
    window.localStorage.removeItem(SPAM_REPORT_PREFERENCE_STORAGE_KEY)
  })

  it('reminds the unread emails of Spam, in a live region, and hides for 24 hours once dismissed', async () => {
    const server = makeServer()
    await renderFolder(server, 'mailbox-inbox')

    const banner = await screen.findByTestId('spam-report-banner')
    expect(banner).toHaveRole('status')
    expect(banner).toHaveTextContent('3 messages in spam')

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByTestId('spam-report-banner')).toBeNull()
    // The focus stays in the page, not on its body (RGAA 12.8)
    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body)
    })
    const stored: unknown = JSON.parse(
      window.localStorage.getItem(SPAM_REPORT_PREFERENCE_STORAGE_KEY) ?? ''
    )
    expect(stored).toEqual({
      isEnabled: true,
      lastDismissedAt: expect.any(Number),
      lastShownAt: expect.any(Number)
    })
    // As tmail-flutter, Spam is marked as read
    await waitFor(() => {
      expect(server.emails.find(email => email.id === 's')?.keywords).toEqual({
        $seen: true
      })
    })
  })

  it('is not shown in Spam itself', async () => {
    await renderFolder(makeServer(), 'mailbox-spam')
    expect(screen.queryByTestId('spam-report-banner')).toBeNull()
  })

  it('is not shown without unread emails in Spam', async () => {
    await renderFolder(makeServer(0), 'mailbox-inbox')
    await waitFor(() => {
      expect(screen.queryByTestId('spam-report-banner')).toBeNull()
    })
  })

  it('is not shown once turned off', async () => {
    window.localStorage.setItem(
      SPAM_REPORT_PREFERENCE_STORAGE_KEY,
      JSON.stringify({ isEnabled: false, lastDismissedAt: 0 })
    )
    await renderFolder(makeServer(), 'mailbox-inbox')
    expect(screen.queryByTestId('spam-report-banner')).toBeNull()
  })

  it('is not shown within 24 hours of a dismissal, and is after', async () => {
    window.localStorage.setItem(
      SPAM_REPORT_PREFERENCE_STORAGE_KEY,
      JSON.stringify({ isEnabled: true, lastDismissedAt: Date.now() - 1000 })
    )
    await renderFolder(makeServer(), 'mailbox-inbox')
    expect(screen.queryByTestId('spam-report-banner')).toBeNull()
  })

  it('is back after 24 hours', async () => {
    window.localStorage.setItem(
      SPAM_REPORT_PREFERENCE_STORAGE_KEY,
      JSON.stringify({
        isEnabled: true,
        lastDismissedAt: Date.now() - SPAM_REPORT_INTERVAL_MS - 1000
      })
    )
    await renderFolder(makeServer(), 'mailbox-inbox')
    expect(await screen.findByTestId('spam-report-banner')).toBeVisible()
  })

  it('is shown once a day, even when not dismissed', async () => {
    const server = makeServer()
    const { unmount } = await renderFolder(server, 'mailbox-inbox')
    expect(await screen.findByTestId('spam-report-banner')).toBeVisible()
    await waitFor(() => {
      expect(
        window.localStorage.getItem(SPAM_REPORT_PREFERENCE_STORAGE_KEY)
      ).toContain('lastShownAt')
    })
    // Still there while the list shows
    expect(screen.getByTestId('spam-report-banner')).toBeVisible()
    unmount()

    await renderFolder(server, 'mailbox-inbox')
    expect(screen.queryByTestId('spam-report-banner')).toBeNull()
  })

  it('is back 24 hours after its last display', async () => {
    window.localStorage.setItem(
      SPAM_REPORT_PREFERENCE_STORAGE_KEY,
      JSON.stringify({
        isEnabled: true,
        lastDismissedAt: 0,
        lastShownAt: Date.now() - SPAM_REPORT_INTERVAL_MS - 1000
      })
    )
    await renderFolder(makeServer(), 'mailbox-inbox')
    expect(await screen.findByTestId('spam-report-banner')).toBeVisible()
  })

  it('opens Spam with View, and then waits 24 hours', async () => {
    await renderFolder(makeServer(), 'mailbox-inbox')
    await userEvent.click(await screen.findByRole('button', { name: 'View' }))
    await waitFor(() => {
      expect(screen.queryByTestId('spam-report-banner')).toBeNull()
    })
    expect(
      window.localStorage.getItem(SPAM_REPORT_PREFERENCE_STORAGE_KEY)
    ).toContain('lastDismissedAt')
  })
})
