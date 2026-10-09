import { VirtuosoMockContext } from '@linagora/twake-mui'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Route, useLocation, useParams } from 'react-router'

import {
  makeEmail,
  makeFakeJmapServer,
  makeMailbox,
  makeTeamMailboxes,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { SearchFiltersHeader } from './SearchFiltersRow'
import { SearchResults } from './SearchResults'
import { useUrlSearchFilter } from './useUrlSearchFilter'

function SearchScreen(): ReactElement | null {
  const filter = useUrlSearchFilter()
  const location = useLocation()
  return filter === null ? null : (
    <>
      {/* Above the card of the list, as the layout shows it on a desktop */}
      <SearchFiltersHeader />
      <SearchResults filter={filter} />
      <p data-testid="location">{`${location.pathname}${location.search}`}</p>
    </>
  )
}

function OpenedResult(): ReactElement {
  const { emailId } = useParams()
  const { search } = useLocation()
  return <p>{`Opened ${emailId ?? ''} with ${search}`}</p>
}

function renderSearch(
  jmapServer: FakeJmapServer,
  query: string
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <VirtuosoMockContext.Provider
      value={{ viewportHeight: 100_000, itemHeight: 56 }}
    >
      <SearchScreen />
    </VirtuosoMockContext.Provider>,
    {
      route: `/search?${query}`,
      path: '/search',
      withJmapSession: true,
      jmapServer,
      routes: <Route path="/search/email/:emailId" element={<OpenedResult />} />
    }
  )
}

function makeServer(): FakeJmapServer {
  return makeFakeJmapServer({
    mailboxes: [
      makeMailbox({ id: 'mailbox-inbox', name: 'INBOX', role: 'inbox' }),
      makeMailbox({ id: 'mailbox-archive', name: 'Archive', role: 'archive' }),
      makeMailbox({ id: 'mailbox-trash', name: 'Trash', role: 'trash' }),
      makeMailbox({ id: 'mailbox-spam', name: 'Spam', role: 'junk' })
    ],
    emails: [
      makeEmail({
        id: 'report',
        subject: '<Quarterly> report',
        preview: 'The report is attached',
        receivedAt: '2026-10-02T08:00:00Z',
        hasAttachment: true
      }),
      makeEmail({
        id: 'archived',
        subject: 'Old report',
        preview: 'From last year',
        receivedAt: '2025-10-01T08:00:00Z',
        mailboxIds: { 'mailbox-archive': true }
      }),
      makeEmail({
        id: 'trashed',
        subject: 'Deleted report',
        mailboxIds: { 'mailbox-trash': true }
      }),
      makeEmail({ id: 'other', subject: 'Lunch', preview: 'Pizza?' })
    ]
  })
}

function rows(): HTMLElement[] {
  return screen.getAllByTestId('email-list-item')
}

describe('SearchResults', () => {
  it('lists the matching emails out of the trash and the spam, the matches highlighted', async () => {
    const server = makeServer()
    renderSearch(server, 'q=report&sort=relevance')

    await waitFor(() => {
      expect(rows()).toHaveLength(2)
    })
    const [first] = rows()
    if (!first) throw new Error('No row')
    const subject = within(first).getByTestId('email-list-item-subject')
    expect(subject).toHaveTextContent('<Quarterly> report')
    expect(within(subject).getByText('report').tagName).toBe('MARK')
    expect(
      within(rows()[1] ?? first).getByTestId('email-list-item-mailbox')
    ).toHaveTextContent('In Archive')
    expect(
      screen.getByRole('heading', { name: 'Search results' })
    ).toHaveFocus()

    const query = server.requests
      .flatMap(request => request.methodCalls)
      .find(([name]) => name === 'Email/query')
    expect(query?.[1]).toEqual(
      expect.objectContaining({
        filter: {
          text: 'report',
          inMailboxOtherThan: ['mailbox-spam', 'mailbox-trash']
        },
        sort: null
      })
    )
    expect(server.calledMethods()).toContain('SearchSnippet/get')
  })

  it('finds the emails of a team mailbox, not the ones in its Trash', async () => {
    const server = makeFakeJmapServer({
      mailboxes: [
        makeMailbox({ id: 'mailbox-inbox', name: 'INBOX', role: 'inbox' }),
        makeMailbox({ id: 'mailbox-trash', name: 'Trash', role: 'trash' }),
        ...makeTeamMailboxes()
      ],
      emails: [
        makeEmail({
          id: 'team-report',
          subject: 'Team report',
          mailboxIds: { 'team-inbox': true }
        }),
        makeEmail({
          id: 'team-deleted',
          subject: 'Team deleted report',
          mailboxIds: { 'team-trash': true }
        })
      ]
    })
    renderSearch(server, 'q=report')

    await waitFor(() => {
      expect(rows()).toHaveLength(1)
    })
    expect(
      within(rows()[0] ?? document.body).getByTestId('email-list-item-subject')
    ).toHaveTextContent('Team report')
  })

  it('shows the empty view when nothing matches', async () => {
    renderSearch(makeServer(), 'q=nothing')

    expect(await screen.findByTestId('empty-search-view')).toHaveTextContent(
      'No emails are matching your search'
    )
  })

  it('runs the search again when a filter changes, in the URL', async () => {
    const server = makeServer()
    renderSearch(server, 'q=report')
    await waitFor(() => {
      expect(rows()).toHaveLength(2)
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Has attachment' })
    )

    await waitFor(() => {
      expect(rows()).toHaveLength(1)
    })
    expect(
      screen.getByRole('button', { name: 'Has attachment' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/search?q=report&attachment=1&sort=relevance'
    )
  })

  it('orders the results as picked, and remembers the order', async () => {
    const server = makeServer()
    renderSearch(server, 'q=report')
    await waitFor(() => {
      expect(rows()).toHaveLength(2)
    })

    await userEvent.click(screen.getByRole('button', { name: 'Relevance' }))
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Oldest' }))

    await waitFor(() => {
      expect(
        rows().map(row => within(row).getByTestId('email-list-item-subject'))
      ).toHaveLength(2)
    })
    await waitFor(() => {
      expect(
        within(rows()[0] ?? document.body).getByTestId(
          'email-list-item-subject'
        )
      ).toHaveTextContent('Old report')
    })
    expect(window.localStorage.getItem('twake-mail.search.sort-order')).toBe(
      'oldest'
    )
    window.localStorage.clear()
  })

  it('opens a result in the search, keeping the search in the URL', async () => {
    renderSearch(makeServer(), 'q=report')
    await waitFor(() => {
      expect(rows()).toHaveLength(2)
    })

    await userEvent.click(screen.getByRole('link', { name: /Quarterly/ }))

    expect(
      await screen.findByText('Opened report with ?q=report&sort=relevance')
    ).toBeVisible()
  })

  it('adds a sender from the From chip and leaves the events out', async () => {
    renderSearch(makeServer(), 'q=report')
    await waitFor(() => {
      expect(rows()).toHaveLength(2)
    })

    await userEvent.click(screen.getByRole('button', { name: 'From' }))
    const picker = await screen.findByRole('dialog', {
      name: 'Find emails from'
    })
    await userEvent.type(
      within(picker).getByRole('searchbox', { name: 'Enter name or email' }),
      'alice@example.com'
    )
    await userEvent.click(
      await within(picker).findByRole('checkbox', { name: 'alice@example.com' })
    )
    await userEvent.click(within(picker).getByRole('button', { name: 'Done' }))

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        'from=alice%40example.com'
      )
    })
    expect(
      screen.getByRole('button', {
        name: 'Remove the filter From: alice@example.com'
      })
    ).toBeVisible()

    await userEvent.click(
      screen.getByRole('button', { name: "Don't include events" })
    )

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('noevents=1')
    })
  })

  it('titles the results for assistive technologies without showing a heading row', async () => {
    renderSearch(makeServer(), 'q=report')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Search results' })
    ).toHaveClass('u-visuallyhidden')
  })
})
