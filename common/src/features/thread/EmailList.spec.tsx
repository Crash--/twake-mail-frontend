import { VirtuosoMockContext } from '@linagora/twake-mui'
import { onlineManager } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, useParams } from 'react-router'
import { useState, type ReactElement } from 'react'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import {
  FAKE_ACCOUNT_ID,
  FAKE_USERNAME,
  makeEmail,
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeTeamMailboxes,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeLabels
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'

import { EmailList } from './EmailList'
import { ListFilterProvider } from './ListFilterProvider'
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
  state: unknown = null,
  viewportHeight = 100_000
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <VirtuosoMockContext.Provider value={{ viewportHeight, itemHeight: 56 }}>
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

function setOnline(isOnline: boolean): void {
  jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(isOnline)
  act(() => {
    window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'))
  })
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
  listEmailsOneByOne()

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
    renderList(server, 'mailbox-inbox', null, 56 * 10)

    await screen.findAllByTestId('email-list-item')
    const scroller = document.querySelector('[data-virtuoso-scroller]')
    if (!scroller) throw new Error('No scroller')
    const queriedPositions = (): unknown[] =>
      server.requests.flatMap(({ methodCalls }) =>
        methodCalls
          .filter(([name]) => name === 'Email/query')
          .map(([, args]) => args.position)
      )

    // Only the rows near the viewport are rendered: scroll to the end of
    // what is loaded, once per page
    await waitFor(() => {
      const loaded = EMAIL_LIST_PAGE_SIZE * queriedPositions().length
      fireEvent.scroll(scroller, { target: { scrollTop: 56 * (loaded - 5) } })
      expect(queriedPositions()).toEqual([
        0,
        EMAIL_LIST_PAGE_SIZE,
        EMAIL_LIST_PAGE_SIZE * 2
      ])
    })
    fireEvent.scroll(scroller, { target: { scrollTop: 56 * total } })
    expect(await screen.findByText(`Email ${total - 1}`)).toBeVisible()
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

  it('marks the emails their sender set important, unless turned off', async () => {
    const emails = [
      makeEmail({
        id: 'urgent',
        subject: 'Urgent',
        headers: { Importance: 'high' }
      }),
      makeEmail({ id: 'plain', subject: 'Plain' })
    ]
    const { unmount } = renderList(makeFakeJmapServer({ emails }))

    const link = await screen.findByRole('link', { name: /Urgent/ })
    expect(link).toHaveAccessibleName(/Important/)
    expect(screen.getAllByTestId('important-flag-icon')).toHaveLength(1)
    unmount()

    renderList(
      makeFakeJmapServer({
        emails,
        capabilities: { 'com:linagora:params:jmap:settings': {} },
        settings: { 'display.sender.priority': 'false' }
      })
    )
    await screen.findByRole('link', { name: /Urgent/ })
    await waitFor(() => {
      expect(screen.queryByTestId('important-flag-icon')).toBe(null)
    })
  })

  it('shows rows of skeleton, busy and hidden to screen readers, while the emails load', async () => {
    const server = makeFakeJmapServer({
      emails: [makeEmail({ id: 'e1', subject: 'Landed' })]
    })
    const release = server.holdRequests('Email/query')
    renderList(server)

    const skeleton = await screen.findByTestId('email-list-loading')
    expect(skeleton).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('table')).toBe(null)
    expect(screen.queryByTestId('email-list')).toBe(null)

    release()

    expect(await screen.findByText('Landed')).toBeVisible()
    expect(screen.queryByTestId('email-list-loading')).toBe(null)
  })

  it('shows the empty view for a mailbox without emails', async () => {
    renderList(makeFakeJmapServer({ emails: [] }))

    expect(await screen.findByTestId('empty-thread-view')).toHaveTextContent(
      'You don’t have any emails in this folder.'
    )
    expect(screen.queryByTestId('email-list')).toBe(null)
  })

  it('says that no email matches the filter, without the hint', async () => {
    renderWithProviders(
      <ListFilterProvider>
        <VirtuosoMockContext.Provider
          value={{ viewportHeight: 100_000, itemHeight: 56 }}
        >
          <EmailList mailboxId="mailbox-inbox" />
        </VirtuosoMockContext.Provider>
      </ListFilterProvider>,
      {
        route: '/mailbox/mailbox-inbox',
        path: '/mailbox/:mailboxId',
        withJmapSession: true,
        jmapServer: makeFakeJmapServer({ emails: makeEmails(2) })
      }
    )
    await screen.findAllByTestId('email-list-item')

    await userEvent.click(screen.getByTestId('list-filter-button'))
    await userEvent.click(await screen.findByTestId('quick-filter-unread'))

    const empty = await screen.findByTestId('empty-thread-view')
    expect(empty).toHaveTextContent(
      'There are no emails that match your current filter.'
    )
    expect(empty).not.toHaveTextContent('Start to compose emails.')
  })

  describe('offline', () => {
    afterEach(() => {
      onlineManager.setOnline(true)
      jest.restoreAllMocks()
    })

    it('says there is no connection instead of the empty view', async () => {
      renderList(makeFakeJmapServer({ emails: [] }))
      await screen.findByTestId('empty-thread-view')

      setOnline(false)

      expect(screen.getByTestId('email-list-offline')).toHaveTextContent(
        'No internet connection, try again later.'
      )
      expect(screen.queryByTestId('empty-thread-view')).toBe(null)

      setOnline(true)

      expect(await screen.findByTestId('empty-thread-view')).toBeVisible()
    })

    it('keeps the emails already listed', async () => {
      renderList(
        makeFakeJmapServer({
          emails: [makeEmail({ id: 'e1', subject: 'Kept' })]
        })
      )
      await screen.findByText('Kept')

      setOnline(false)

      expect(screen.getByText('Kept')).toBeVisible()
      expect(screen.queryByTestId('email-list-offline')).toBe(null)
    })

    it('shows the offline view, not skeletons, while a first load waits for the network', async () => {
      const server = makeFakeJmapServer({
        emails: [makeEmail({ id: 'e1', subject: 'Landed' })]
      })
      const release = server.holdRequests('Email/query')
      renderList(server)
      await screen.findByTestId('email-list-loading')

      setOnline(false)

      expect(screen.getByTestId('email-list-offline')).toBeVisible()
      expect(screen.queryByTestId('email-list-loading')).toBe(null)

      setOnline(true)
      release()

      expect(await screen.findByText('Landed')).toBeVisible()
      expect(screen.queryByTestId('email-list-offline')).toBe(null)
    })
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

  it('shows the recipients in the Drafts of a team mailbox, known by its name', async () => {
    renderList(
      makeFakeJmapServer({
        mailboxes: [...makeDefaultMailboxes(), ...makeTeamMailboxes()],
        emails: [
          makeEmail({
            id: 'team-draft',
            mailboxIds: { 'team-drafts': true },
            keywords: { $draft: true },
            to: [{ name: 'Bob Dupont', email: 'bob@example.com' }]
          })
        ]
      }),
      'team-drafts'
    )

    expect(
      await screen.findByTestId('email-list-item-sender')
    ).toHaveTextContent('Bob Dupont')
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
    expect(star).toHaveAccessibleName('Starred')
    expect(star).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(star)

    expect(star).toHaveAttribute('aria-pressed', 'true')
    // A toggle keeps its name, the state is in aria-pressed
    expect(star).toHaveAccessibleName('Starred')
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
    ).toEqual([
      'Selection, Status',
      'Sender',
      'Subject',
      'Attachment, Date, Actions'
    ])
  })

  it('shows the initials of the sender, hidden from assistive technologies, and reaches the row actions by keyboard', async () => {
    renderList(makeFakeJmapServer({ emails: makeEmails(1) }))
    const row = await screen.findByTestId('email-list-item')

    expect(within(row).getByTestId('email-list-item-avatar')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    within(row).getByTestId('email-list-item-star').focus()
    // The link of the row, then its actions
    await userEvent.tab()
    await userEvent.tab()
    await userEvent.tab()

    expect(
      within(row).getByRole('button', { name: 'Mark as unread' })
    ).toHaveFocus()
  })

  it('shows a replied or forwarded email as a state, not as an action, and nothing on the others', async () => {
    renderList(
      makeFakeJmapServer({
        emails: [
          makeEmail({
            id: 'a',
            subject: 'Answered',
            keywords: { $seen: true, $answered: true }
          }),
          makeEmail({
            id: 'f',
            subject: 'Forwarded',
            keywords: { $seen: true, $forwarded: true }
          }),
          makeEmail({
            id: 'af',
            subject: 'Both',
            keywords: { $seen: true, $answered: true, $forwarded: true }
          }),
          makeEmail({ id: 'n', subject: 'Plain' })
        ]
      })
    )
    const rows = await screen.findAllByTestId('email-list-item')

    const [answered, forwarded, both, plain] = rows.map(row => ({
      status: within(row).queryByTestId('email-list-item-status'),
      link: within(row).getByRole('link')
    }))
    // The row link says it, like unread and starred; the image is for the eye
    expect(answered?.link).toHaveAccessibleName(/Replied/)
    expect(answered?.link).not.toHaveAccessibleName(/Forwarded/)
    expect(forwarded?.link).toHaveAccessibleName(/Forwarded/)
    expect(both?.link).toHaveAccessibleName(/Replied, Forwarded/)
    expect(plain?.link).not.toHaveAccessibleName(/Replied|Forwarded/)
    expect(plain?.status).toBeNull()
    expect(answered?.status).toHaveAttribute('aria-hidden', 'true')
    expect(forwarded?.status).toHaveAttribute('aria-hidden', 'true')
    expect(both?.status).toHaveAttribute('aria-hidden', 'true')
    // A passive image: no button to reply to from the row, nothing to focus
    expect(answered?.status).not.toHaveAttribute('tabindex')
    expect(screen.queryByTestId('email-list-item-reply')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Reply/ })).toBeNull()
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

  it('focuses the first row when that email left the list', async () => {
    renderList(makeFakeJmapServer({ emails: makeEmails(3) }), 'mailbox-inbox', {
      focusEmailId: 'deleted'
    })

    const [row] = await screen.findAllByTestId('email-list-item')
    if (!row) throw new Error('No row')
    await waitFor(() => {
      expect(within(row).getByRole('link')).toHaveFocus()
    })
  })

  it('focuses the row again once a closing menu dropped it', async () => {
    renderList(makeFakeJmapServer({ emails: makeEmails(3) }), 'mailbox-inbox', {
      focusEmailId: 'e0'
    })
    const [row] = await screen.findAllByTestId('email-list-item')
    if (!row) throw new Error('No row')
    const link = within(row).getByRole('link')
    await waitFor(() => {
      expect(link).toHaveFocus()
    })

    link.blur()

    await waitFor(() => {
      expect(link).toHaveFocus()
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
      ).toEqual(['Selection', 'Status', 'Message', 'Actions'])
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
        within(row).getByRole('button', { name: 'Starred' })
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

  it('shows one row per conversation with its size when threads are on', async () => {
    window.localStorage.setItem('twake-mail.preferences.thread', 'true')
    const server = makeFakeJmapServer({
      emails: [
        makeEmail({
          id: 'first',
          threadId: 'kick-off',
          subject: 'Kick-off',
          receivedAt: '2026-10-01T08:00:00Z'
        }),
        makeEmail({
          id: 'reply',
          threadId: 'kick-off',
          subject: 'Re: Kick-off',
          receivedAt: '2026-10-02T08:00:00Z'
        }),
        makeEmail({ id: 'other', subject: 'Lunch' })
      ]
    })
    renderList(server)

    const rows = await screen.findAllByTestId('email-list-item')
    expect(rows).toHaveLength(2)
    const conversation = screen.getByRole('link', { name: /Re: Kick-off/ })
    expect(conversation).toHaveAccessibleName(/2 messages/)
    const query = server.requests
      .flatMap(request => request.methodCalls)
      .find(([name]) => name === 'Email/query')
    expect(query?.[1].collapseThreads).toBe(true)
    window.localStorage.clear()
  })

  it('names a conversation by its participants, its size and its state', async () => {
    window.localStorage.setItem('twake-mail.preferences.thread', 'true')
    const server = makeFakeJmapServer({
      emails: [
        makeEmail({
          id: 'first',
          threadId: 'plan',
          subject: 'Plan',
          from: [{ name: 'Bob Dupont', email: 'bob@example.com' }],
          keywords: { $seen: true, $flagged: true },
          hasAttachment: true,
          receivedAt: '2026-10-01T08:00:00Z'
        }),
        makeEmail({
          id: 'mine',
          threadId: 'plan',
          subject: 'Re: Plan',
          mailboxIds: { 'mailbox-sent': true },
          from: [{ name: 'Alice Martin', email: FAKE_USERNAME }],
          to: [{ name: 'Bob Dupont', email: 'bob@example.com' }],
          keywords: { $seen: true },
          receivedAt: '2026-10-02T08:00:00Z'
        }),
        makeEmail({
          id: 'last',
          threadId: 'plan',
          subject: 'Re: Plan',
          from: [{ name: 'Carol Petit', email: 'carol@example.com' }],
          receivedAt: '2026-10-03T08:00:00Z'
        })
      ]
    })
    renderList(server)

    const row = await screen.findByTestId('email-list-item')
    expect(row).toHaveAttribute('data-email-id', 'last')
    expect(row).toHaveAttribute('data-unread', 'true')
    expect(within(row).getByTestId('email-list-item-sender')).toHaveTextContent(
      /^Bob Dupont, Me, Carol Petit$/
    )
    // Beside the names, out of their ellipsis
    expect(
      within(row).getByTestId('email-list-item-thread-count')
    ).toHaveTextContent('(3)')
    expect(within(row).getByRole('link')).toHaveAccessibleName(
      /^Unread, Starred, Bob Dupont, Me, Carol Petit, 3 messages, Re: Plan/
    )
    expect(
      within(row).getByRole('img', { name: 'Attachment' })
    ).toBeInTheDocument()
    expect(
      within(row).getByRole('button', { name: 'Starred' })
    ).toHaveAttribute('aria-pressed', 'true')
    window.localStorage.clear()
  })

  it('reads and stars every email of a conversation from its row', async () => {
    window.localStorage.setItem('twake-mail.preferences.thread', 'true')
    const server = makeFakeJmapServer({
      emails: [
        makeEmail({
          id: 'first',
          threadId: 'plan',
          receivedAt: '2026-10-01T08:00:00Z'
        }),
        makeEmail({
          id: 'last',
          threadId: 'plan',
          keywords: { $seen: true },
          receivedAt: '2026-10-03T08:00:00Z'
        })
      ]
    })
    renderList(server)
    // Rows render again as their emails change: read them each time
    const row = (): HTMLElement => screen.getByTestId('email-list-item')
    await screen.findByTestId('email-list-item')

    await userEvent.click(
      within(row()).getByRole('button', { name: 'Starred' })
    )
    await userEvent.click(
      await within(row()).findByRole('button', { name: 'Mark as read' })
    )

    await waitFor(() => {
      expect(server.emails.map(email => email.keywords)).toEqual([
        { $flagged: true, $seen: true },
        { $seen: true, $flagged: true }
      ])
    })
    expect(row()).not.toHaveAttribute('data-unread')
    window.localStorage.clear()
  })

  it('shows on a conversation row the labels of the email that stands for it', async () => {
    window.localStorage.setItem('twake-mail.preferences.thread', 'true')
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES,
      emails: [
        makeEmail({
          id: 'first',
          threadId: 'plan',
          subject: 'Plan',
          keywords: { $seen: true, work: true },
          receivedAt: '2026-10-01T08:00:00Z'
        }),
        makeEmail({
          id: 'last',
          threadId: 'plan',
          subject: 'Re: Plan',
          keywords: { $seen: true, urgent: true },
          receivedAt: '2026-10-03T08:00:00Z'
        })
      ]
    })
    installFakeLabels(server, [
      { id: 'work', displayName: 'Work', keyword: 'work', color: '#273891' },
      {
        id: 'urgent',
        displayName: 'Urgent',
        keyword: 'urgent',
        color: '#F44336'
      }
    ])
    renderList(server)

    // As tmail-flutter (thread_view.dart: presentationEmail.getLabelList):
    // the labels of the last email, not the union of the conversation
    const row = await screen.findByTestId('email-list-item')
    expect(await within(row).findByTestId('label-chip')).toHaveTextContent(
      'Urgent'
    )
    expect(within(row).queryByText('Work')).toBe(null)
    window.localStorage.clear()
  })

  it('hides the label chips once "Display labels" is turned off', async () => {
    const server = makeFakeJmapServer({
      capabilities: FAKE_LINAGORA_CAPABILITIES,
      emails: [
        makeEmail({
          id: 'plan',
          subject: 'Plan',
          keywords: { $seen: true, work: true }
        })
      ]
    })
    installFakeLabels(server, [
      { id: 'work', displayName: 'Work', keyword: 'work', color: '#273891' }
    ])
    renderList(server)
    const row = await screen.findByTestId('email-list-item')
    expect(await within(row).findByTestId('label-chips')).toBeInTheDocument()

    // The labels stay in the cache of the query this disables
    act(() => {
      window.localStorage.setItem('twake-mail.preferences.labels', 'false')
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'twake-mail.preferences.labels' })
      )
    })

    expect(within(row).queryByTestId('label-chips')).toBe(null)
    window.localStorage.clear()
  })
})
