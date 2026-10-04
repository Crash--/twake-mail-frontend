import { VirtuosoMockContext } from '@linagora/twake-mui'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, useParams } from 'react-router'
import { useState, type ReactElement } from 'react'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import {
  FAKE_ACCOUNT_ID,
  makeEmail,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EmailList } from './EmailList'
import { EMAIL_LIST_PAGE_SIZE, threadKeys } from './queries'

function OpenedEmail(): ReactElement {
  const { mailboxId, emailId } = useParams()
  return (
    <p>
      Opened {emailId} of {mailboxId}
    </p>
  )
}

function renderList(
  jmapServer: FakeJmapServer,
  mailboxId = 'mailbox-inbox',
  state: unknown = null
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <VirtuosoMockContext.Provider
      value={{ viewportHeight: 100_000, itemHeight: 56 }}
    >
      <EmailList mailboxId={mailboxId} />
    </VirtuosoMockContext.Provider>,
    {
      route: { pathname: `/mailbox/${mailboxId}`, state },
      path: '/mailbox/:mailboxId',
      withJmapSession: true,
      jmapServer,
      routes: (
        <Route
          path="/mailbox/:mailboxId/email/:emailId"
          element={<OpenedEmail />}
        />
      )
    }
  )
}

function makeEmails(count: number): ReturnType<typeof makeEmail>[] {
  return Array.from({ length: count }, (_, index) =>
    makeEmail({
      id: `e${index}`,
      subject: `Email ${index}`,
      receivedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, count - index))
        .toISOString()
        .replace('.000', ''),
      keywords: { $seen: true }
    })
  )
}

describe('EmailList', () => {
  it('lists the emails of the mailbox, most recent first, in one request', async () => {
    const server = makeFakeJmapServer({
      emails: [
        makeEmail({
          id: 'old',
          subject: 'Old news',
          receivedAt: '2025-03-01T10:00:00Z',
          keywords: { $seen: true, $flagged: true }
        }),
        makeEmail({
          id: 'new',
          subject: 'Fresh news',
          preview: 'Hello Alice',
          receivedAt: '2026-02-14T10:00:00Z'
        }),
        makeEmail({
          id: 'elsewhere',
          mailboxIds: { 'mailbox-trash': true }
        })
      ]
    })
    renderList(server)

    const rows = await screen.findAllByTestId('email-list-item')

    expect(rows.map(row => row.getAttribute('data-email-id'))).toEqual([
      'new',
      'old'
    ])
    const [fresh, old] = rows
    if (!fresh || !old) throw new Error('Two rows expected')
    expect(fresh).toHaveAttribute('data-unread', 'true')
    expect(fresh).toHaveAttribute('data-thread-id', 'thread-new')
    expect(
      within(fresh).getByTestId('email-list-item-sender')
    ).toHaveTextContent('Bob Dupont')
    expect(
      within(fresh).getByTestId('email-list-item-subject')
    ).toHaveTextContent('Fresh news')
    expect(
      within(fresh).getByTestId('email-list-item-preview')
    ).toHaveTextContent('Hello Alice')
    expect(within(fresh).getByTestId('email-list-item-date')).toHaveTextContent(
      'Feb 14'
    )
    expect(within(fresh).getByTestId('email-list-item-star')).toHaveAttribute(
      'aria-pressed',
      'false'
    )
    expect(old).not.toHaveAttribute('data-unread')
    expect(within(old).getByTestId('email-list-item-star')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    const [request] = server.requests.filter(({ methodCalls }) =>
      methodCalls.some(([name]) => name === 'Email/query')
    )
    expect(request?.methodCalls).toEqual([
      [
        'Email/query',
        expect.objectContaining({
          filter: { inMailbox: 'mailbox-inbox' },
          sort: [{ property: 'receivedAt', isAscending: false }],
          position: 0,
          limit: EMAIL_LIST_PAGE_SIZE
        }),
        expect.any(String)
      ],
      [
        'Email/get',
        expect.objectContaining({
          '#ids': expect.objectContaining({ name: 'Email/query', path: '/ids' })
        }),
        expect.any(String)
      ]
    ])
  })

  it('loads the next pages when the end of the list is reached', async () => {
    const total = EMAIL_LIST_PAGE_SIZE * 2 + 5
    const server = makeFakeJmapServer({ emails: makeEmails(total) })
    renderList(server)

    await waitFor(() => {
      expect(screen.getAllByTestId('email-list-item')).toHaveLength(total)
    })
    const positions = server.requests.flatMap(({ methodCalls }) =>
      methodCalls
        .filter(([name]) => name === 'Email/query')
        .map(([, args]) => args.position)
    )
    expect(positions).toEqual([
      0,
      EMAIL_LIST_PAGE_SIZE,
      EMAIL_LIST_PAGE_SIZE * 2
    ])
  })

  it('reloads a list shown again once stale, even after its last page', async () => {
    const server = makeFakeJmapServer({ emails: makeEmails(3) })
    function TogglableList(): ReactElement {
      const [isShown, setIsShown] = useState(true)
      const handleToggle = (): void => {
        setIsShown(shown => !shown)
      }
      return (
        <>
          <button type="button" onClick={handleToggle}>
            Toggle the list
          </button>
          {isShown ? <EmailList mailboxId="mailbox-inbox" /> : null}
        </>
      )
    }
    renderWithProviders(
      <VirtuosoMockContext.Provider
        value={{ viewportHeight: 100_000, itemHeight: 56 }}
      >
        <TogglableList />
      </VirtuosoMockContext.Provider>,
      {
        route: '/mailbox/mailbox-inbox',
        path: '/mailbox/:mailboxId',
        withJmapSession: true,
        jmapServer: server
      }
    )
    await screen.findAllByTestId('email-list-item')
    const toggle = screen.getByRole('button', { name: 'Toggle the list' })

    await userEvent.click(toggle)
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000)
    try {
      await userEvent.click(toggle)

      await waitFor(() => {
        expect(
          server.calledMethods().filter(name => name === 'Email/query')
        ).toHaveLength(2)
      })
    } finally {
      now.mockRestore()
    }
  })

  it('shows the empty view for a mailbox without emails', async () => {
    renderList(makeFakeJmapServer({ emails: [] }))

    expect(await screen.findByTestId('empty-thread-view')).toHaveTextContent(
      'There are no emails in your current folder'
    )
    expect(screen.queryByTestId('email-list')).toBe(null)
  })

  it('shows the recipients in the Sent folder', async () => {
    renderList(
      makeFakeJmapServer({
        emails: [
          makeEmail({
            id: 'sent',
            mailboxIds: { 'mailbox-sent': true },
            to: [
              { name: 'Bob Dupont', email: 'bob@example.com' },
              { name: null, email: 'carol@example.com' }
            ]
          })
        ]
      }),
      'mailbox-sent'
    )

    expect(
      await screen.findByTestId('email-list-item-sender')
    ).toHaveTextContent('Bob Dupont, carol@example.com')
  })

  it('opens an email on click', async () => {
    renderList(makeFakeJmapServer({ emails: makeEmails(1) }))

    await userEvent.click(await screen.findByText('Email 0'))

    expect(screen.getByText('Opened e0 of mailbox-inbox')).toBeVisible()
  })

  it('stars and unstars an email', async () => {
    const server = makeFakeJmapServer({ emails: makeEmails(1) })
    const release = server.holdRequests('Email/set')
    renderList(server)
    const star = await screen.findByTestId('email-list-item-star')
    expect(star).toHaveAccessibleName('Mark as starred')

    await userEvent.click(star)

    expect(star).toHaveAttribute('aria-pressed', 'true')
    expect(star).toHaveAccessibleName('Unstar')
    release()
    await waitFor(() => {
      expect(server.emails[0]?.keywords).toEqual({
        $seen: true,
        $flagged: true
      })
    })

    await userEvent.click(star)

    await waitFor(() => {
      expect(server.emails[0]?.keywords).toEqual({ $seen: true })
    })
    expect(star).toHaveAttribute('aria-pressed', 'false')
  })

  it('makes each row a link named by the state, the sender and the subject', async () => {
    renderList(
      makeFakeJmapServer({
        emails: [
          makeEmail({
            id: 'new',
            subject: 'Fresh news',
            preview: 'Hello Alice',
            keywords: { $flagged: true }
          })
        ]
      })
    )

    const link = await screen.findByRole('link', {
      name: 'Unread, Starred, Bob Dupont, Fresh news Hello Alice'
    })
    expect(link).toHaveAttribute('href', '/mailbox/mailbox-inbox/email/new')
    expect(screen.getByRole('table', { name: 'Messages' })).toContainElement(
      link
    )
    expect(
      screen.getAllByRole('columnheader').map(header => header.textContent)
    ).toEqual(['Status', 'Sender', 'Subject', 'Attachment', 'Date', 'Actions'])
  })

  it('opens an email from the keyboard', async () => {
    renderList(makeFakeJmapServer({ emails: makeEmails(2) }))
    const [first] = await screen.findAllByRole('link')
    first?.focus()

    await userEvent.keyboard('{ArrowDown}{Enter}')

    expect(screen.getByText('Opened e1 of mailbox-inbox')).toBeVisible()
  })

  it('marks an email as read, then unread, from its row actions', async () => {
    const server = makeFakeJmapServer({
      emails: [makeEmail({ id: 'new', subject: 'Fresh news' })]
    })
    renderList(server)
    const row = await screen.findByTestId('email-list-item')

    await userEvent.click(
      within(row).getByRole('button', { name: 'Mark as read' })
    )

    expect(row).not.toHaveAttribute('data-unread')
    await waitFor(() => {
      expect(server.emails[0]?.keywords).toEqual({ $seen: true })
    })

    await userEvent.click(
      within(row).getByRole('button', { name: 'Mark as unread' })
    )

    await waitFor(() => {
      expect(server.emails[0]?.keywords).toEqual({})
    })
    expect(row).toHaveAttribute('data-unread', 'true')
  })

  it('announces the emails that arrive, not the ones loaded by scrolling', async () => {
    const server = makeFakeJmapServer({ emails: makeEmails(2) })
    const { queryClient } = renderList(server)
    await screen.findAllByTestId('email-list-item')
    expect(screen.getByTestId('new-emails-status')).toHaveTextContent(/^$/)

    server.emails.push(
      makeEmail({
        id: 'pushed',
        subject: 'Pushed',
        receivedAt: '2026-06-01T00:00:00Z'
      })
    )
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: threadKeys.all(FAKE_ACCOUNT_ID)
      })
    })

    expect(await screen.findByText('Pushed')).toBeVisible()
    expect(screen.getByTestId('new-emails-status')).toHaveTextContent(
      'You have new messages'
    )
  })

  it('gives the focus back to the email the user comes back from', async () => {
    renderList(makeFakeJmapServer({ emails: makeEmails(3) }), 'mailbox-inbox', {
      focusEmailId: 'e0'
    })

    // The first row: virtuoso does not render a list scrolled to another
    // row without layout (jsdom); the e2e keyboard spec covers that case
    const [row] = await screen.findAllByTestId('email-list-item')
    if (!row) throw new Error('No row')
    await waitFor(() => {
      expect(within(row).getByRole('link')).toHaveFocus()
    })
  })

  describe('on a phone', () => {
    beforeEach(() => {
      mockViewport({ width: 390, touch: true })
    })
    afterEach(resetViewport)

    it('shows each email on four lines, the link named by its content', async () => {
      renderList(
        makeFakeJmapServer({
          emails: [
            makeEmail({
              id: 'new',
              subject: 'Fresh news',
              preview: 'Hello Alice',
              receivedAt: '2026-10-04T08:30:00Z',
              keywords: { $flagged: true },
              hasAttachment: true
            })
          ]
        })
      )

      const row = await screen.findByTestId('email-list-item')
      expect(
        screen.getAllByRole('columnheader').map(header => header.textContent)
      ).toEqual(['Status', 'Message', 'Actions'])
      const link = within(row).getByRole('link')
      expect(link).toHaveAccessibleName(
        /^Unread, Starred, Bob Dupont Attachment .+ Fresh news Hello Alice$/
      )
      expect(link).toContainElement(
        within(row).getByTestId('email-list-item-date')
      )
      expect(within(row).getByTestId('unread-status-icon')).toBeInTheDocument()
    })

    it('keeps the star and the read toggle on each row', async () => {
      const server = makeFakeJmapServer({
        emails: [makeEmail({ id: 'new', subject: 'Fresh news' })]
      })
      renderList(server)
      const row = await screen.findByTestId('email-list-item')

      await userEvent.click(
        within(row).getByRole('button', { name: 'Mark as starred' })
      )
      await userEvent.click(
        within(row).getByRole('button', { name: 'Mark as read' })
      )

      await waitFor(() => {
        expect(server.emails[0]?.keywords).toEqual({
          $flagged: true,
          $seen: true
        })
      })
    })

    it('leaves room for the floating button after the last row', async () => {
      const { container } = renderList(
        makeFakeJmapServer({ emails: makeEmails(2) })
      )

      await screen.findAllByTestId('email-list-item')
      expect(container.querySelector('tfoot')).toHaveAttribute(
        'aria-hidden',
        'true'
      )
    })
  })
})
