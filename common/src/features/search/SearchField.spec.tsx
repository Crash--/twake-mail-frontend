import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { useLocation } from 'react-router'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { MailboxPickerProvider } from '@common/features/mailbox/MailboxPickerProvider'
import {
  FAKE_USERNAME,
  makeEmail,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EMPTY_SEARCH_FILTER, type SearchFilter } from './searchFilter'
import { SearchField } from './SearchField'

function Location(): ReactElement {
  const { pathname, search } = useLocation()
  return <p data-testid="location">{`${pathname}${search}`}</p>
}

async function renderField(
  jmapServer: FakeJmapServer,
  initialFilter: SearchFilter = EMPTY_SEARCH_FILTER
): Promise<void> {
  // The field stays on screen wherever it navigates, as in the top bar
  renderWithProviders(
    <MailboxPickerProvider>
      <SearchField initialFilter={initialFilter} />
      <Location />
    </MailboxPickerProvider>,
    {
      route: '/mailbox/mailbox-inbox',
      path: '*',
      withJmapSession: true,
      jmapServer
    }
  )
  await screen.findByRole('combobox', { name: 'Search emails' })
}

function makeServer(withContacts = false): FakeJmapServer {
  return makeFakeJmapServer({
    emails: [
      makeEmail({
        id: 'report',
        subject: 'Quarterly report',
        hasAttachment: true
      }),
      makeEmail({ id: 'lunch', subject: 'Lunch report' })
    ],
    capabilities: withContacts
      ? { [LINAGORA_CAPABILITIES.contactAutocomplete]: { minInputLength: 2 } }
      : {},
    contacts: [
      {
        id: 'c1',
        firstname: 'Bob',
        surname: 'Dupont',
        emailAddress: 'bob@example.com'
      }
    ]
  })
}

function combobox(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Search emails' })
}

describe('SearchField', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('suggests the emails the text finds, the matches highlighted', async () => {
    await renderField(makeServer())

    await userEvent.type(combobox(), 'report')

    const listbox = screen.getByRole('listbox', { name: 'Search suggestions' })
    const emails = await within(listbox).findByRole('group', {
      name: 'Messages'
    })
    const options = await within(emails).findAllByRole('option')
    expect(options).toHaveLength(2)
    expect(
      within(options[0] ?? emails).getAllByText('report')[0]?.tagName
    ).toBe('MARK')
    expect(
      within(listbox).getByRole('option', {
        name: 'Showing results for: "report"'
      })
    ).toBeVisible()
  })

  it('applies a quick filter picked under the field on submit', async () => {
    await renderField(makeServer())
    await userEvent.type(combobox(), 'report')

    await userEvent.click(
      screen.getByRole('button', { name: 'Has attachment' })
    )

    expect(
      screen.getByRole('button', { name: 'Has attachment' })
    ).toHaveAttribute('aria-pressed', 'true')
    expect(combobox()).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/search?q=report&attachment=1&sort=relevance'
    )
  })

  it('searches the sender of a typed address, from me with the quick filter', async () => {
    await renderField(makeServer())
    await userEvent.click(combobox())
    await userEvent.click(screen.getByRole('button', { name: 'From me' }))

    await userEvent.type(combobox(), 'bob@example.com{Enter}')

    const params = new URLSearchParams(
      screen.getByTestId('location').textContent.split('?')[1] ?? ''
    )
    expect(params.getAll('from')).toEqual([FAKE_USERNAME, 'bob@example.com'])
    expect(params.get('q')).toBe(null)
  })

  it('opens an email suggestion among the results of the text', async () => {
    await renderField(makeServer())
    await userEvent.type(combobox(), 'Quarterly')
    await screen.findByRole('option', { name: /Quarterly report/ })

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/search/email/report?q=Quarterly&sort=relevance'
    )
  })

  it('suggests contacts when the server autocompletes them', async () => {
    await renderField(makeServer(true))
    await userEvent.type(combobox(), 'bob')

    const contacts = await screen.findByRole('group', { name: 'Contacts' })
    await userEvent.click(
      within(contacts).getByRole('option', { name: /Bob Dupont/ })
    )

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/search?from=bob%40example.com&sort=relevance'
    )
  })

  it('suggests no contact without the capability', async () => {
    const server = makeServer()
    await renderField(server)
    await userEvent.type(combobox(), 'bob')
    await screen.findByRole('option', {
      name: 'Showing results for: "bob"'
    })

    expect(server.calledMethods()).not.toContain('TMailContact/autocomplete')
  })

  it('remembers the searches and suggests them when the field is empty', async () => {
    await renderField(makeServer())
    await userEvent.type(combobox(), 'invoice{Enter}')

    await userEvent.clear(combobox())
    await userEvent.click(combobox())

    const recent = screen.getByRole('group', { name: 'Recent' })
    expect(
      within(recent).getByRole('option', { name: 'invoice' })
    ).toBeVisible()
  })

  it('opens the advanced search on the search being typed', async () => {
    await renderField(makeServer())
    await userEvent.type(combobox(), 'report')
    await userEvent.click(
      screen.getByRole('button', { name: 'Has attachment' })
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Advanced search' })
    )

    const dialog = screen.getByRole('dialog', { name: 'Advanced search' })
    expect(
      within(dialog).getByRole('checkbox', { name: 'Has attachment' })
    ).toBeChecked()
    expect(within(dialog).getByLabelText('Has the words')).toHaveValue('report')

    await userEvent.type(within(dialog).getByLabelText('Subject'), 'Q3')
    await userEvent.type(
      within(dialog).getByLabelText('Doesn’t have'),
      'draft, old'
    )
    await userEvent.click(
      within(dialog).getByRole('combobox', { name: 'Sort by' })
    )
    await userEvent.click(
      within(await screen.findByRole('listbox', { name: 'Sort by' })).getByRole(
        'option',
        { name: 'Oldest' }
      )
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Search' })
    )

    const params = new URLSearchParams(
      screen.getByTestId('location').textContent.split('?')[1] ?? ''
    )
    expect(params.get('subject')).toBe('Q3')
    expect(params.getAll('not')).toEqual(['draft', 'old'])
    expect(params.get('attachment')).toBe('1')
    expect(params.get('sort')).toBe('oldest')
    expect(window.localStorage.getItem('twake-mail.search.sort-order')).toBe(
      'oldest'
    )
  })

  it('takes From and To as tags, suggests contacts, and moves a tag dragged to the other field', async () => {
    await renderField(makeServer(true))
    await userEvent.click(combobox())
    await userEvent.click(
      screen.getByRole('button', { name: 'Advanced search' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Advanced search' })
    const from = within(dialog).getByRole('combobox', { name: 'From' })
    expect(from).toHaveFocus()

    await userEvent.type(from, 'bo')
    await userEvent.click(
      await within(dialog).findByRole('option', { name: /Bob Dupont/ })
    )
    await userEvent.type(from, 'carol, dan,')
    const tags = (): string[] =>
      within(dialog)
        .queryAllByTestId('advanced-search-address-chip')
        .map(chip => chip.getAttribute('aria-label') ?? '')
    expect(tags()).toEqual(['bob@example.com', 'carol', 'dan'])

    // Dragged from From to To (the browser hands one object to the events)
    const data = new Map<string, string>()
    const dataTransfer = {
      get types() {
        return [...data.keys()]
      },
      setData: (type: string, value: string) => {
        data.set(type, value)
      },
      getData: (type: string) => data.get(type) ?? '',
      setDragImage: jest.fn()
    }
    const carol = within(dialog).getAllByTestId(
      'advanced-search-address-chip'
    )[1]
    if (!carol) throw new Error('No tag')
    const to = within(dialog).getByTestId('advanced-search-to-field')
    fireEvent.dragStart(carol, { dataTransfer })
    fireEvent.dragEnter(to, { dataTransfer })
    fireEvent.dragOver(to, { dataTransfer })
    fireEvent.drop(to, { dataTransfer })
    fireEvent.dragEnd(carol, { dataTransfer })

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Search' })
    )

    const params = new URLSearchParams(
      screen.getByTestId('location').textContent.split('?')[1] ?? ''
    )
    expect(params.getAll('from')).toEqual(['bob@example.com', 'dan'])
    expect(params.getAll('to')).toEqual(['carol'])
  })

  it('picks the folder on the destination picker, as tmail-flutter', async () => {
    await renderField(makeServer())
    await userEvent.click(combobox())
    await userEvent.click(
      screen.getByRole('button', { name: 'Advanced search' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Advanced search' })
    const folder = within(dialog).getByRole('button', {
      name: 'Folder All email'
    })
    expect(folder).toHaveAttribute('aria-haspopup', 'dialog')

    await userEvent.click(folder)
    const picker = await screen.findByRole('dialog', { name: 'Select Folder' })
    await userEvent.click(
      within(picker).getByRole('option', { name: /^Inbox/ })
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Select Folder' })).toBe(null)
    })
    // A click in the picker is no click outside the advanced search
    expect(await screen.findByRole('dialog', { name: 'Advanced search' })).toBe(
      dialog
    )
    await waitFor(() => {
      expect(folder).toHaveFocus()
    })
    expect(folder).toHaveAccessibleName('Folder Inbox')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Search' })
    )
    expect(screen.getByTestId('location')).toHaveTextContent('in=mailbox-inbox')
  })

  it('picks a custom range on the date range picker, and shows it in the date', async () => {
    await renderField(makeServer())
    await userEvent.click(combobox())
    await userEvent.click(
      screen.getByRole('button', { name: 'Advanced search' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Advanced search' })
    const date = within(dialog).getByRole('combobox', { name: 'Date' })
    expect(date).toHaveTextContent('All time')
    await userEvent.click(date)
    const options = within(
      await screen.findByRole('listbox', { name: 'Date' })
    ).getAllByRole('option')
    expect(options.map(option => option.textContent)).toEqual([
      'All time',
      'Last 7 days',
      'Last 30 days',
      'Last 6 months',
      'Last 12 months',
      'Custom range'
    ])
    await userEvent.click(screen.getByRole('option', { name: 'Custom range' }))

    let range = await screen.findByRole('dialog', { name: 'Custom range' })
    const start = within(range).getByLabelText('Start date')
    const end = within(range).getByLabelText('End date')
    await userEvent.type(start, '10102026')
    await userEvent.type(end, '01102026')
    await userEvent.click(
      within(range).getByRole('button', { name: 'Set date' })
    )
    // Refused as tmail-flutter refuses it, the problem under the end
    expect(end).toHaveAccessibleDescription(
      'The end time cannot be less than the start time.'
    )
    expect(end).toHaveFocus()

    await userEvent.clear(end)
    await userEvent.type(end, '12102026')
    await userEvent.click(
      within(range).getByRole('button', { name: 'Set date' })
    )
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Custom range' })).toBe(null)
    })
    await waitFor(() => {
      expect(date).toHaveFocus()
    })
    expect(date).toHaveTextContent('From 2026-10-10 to 2026-10-12')

    // The calendar beside the date opens the picker on that range
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Select date' })
    )
    range = await screen.findByRole('dialog', { name: 'Custom range' })
    expect(within(range).getByLabelText('Start date')).toHaveValue('10/10/2026')
    await userEvent.click(within(range).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Custom range' })).toBe(null)
    })
    expect(screen.getByRole('dialog', { name: 'Advanced search' })).toBe(dialog)

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Search' })
    )
    expect(screen.getByTestId('location')).toHaveTextContent(
      'date=custom&start=2026-10-10&end=2026-10-12'
    )
  })

  it('shows only the quick filters under an empty field, collapsed', async () => {
    await renderField(makeServer())

    await userEvent.click(combobox())

    expect(screen.getByRole('group', { name: 'Quick filters' })).toBeVisible()
    expect(screen.queryByRole('listbox')).toBe(null)
    expect(combobox()).toHaveAttribute('aria-expanded', 'false')
    expect(combobox()).not.toHaveAttribute('aria-controls')
    expect(
      within(screen.getByTestId('search-bar')).getByRole('status')
    ).toHaveTextContent(
      'No suggestions. The quick filters follow the search field.'
    )
  })

  it('runs the quick filters picked under an empty field from an option', async () => {
    await renderField(makeServer())
    await userEvent.click(combobox())

    await userEvent.click(screen.getByRole('button', { name: 'Starred' }))
    await userEvent.click(
      screen.getByRole('option', { name: 'Search with these filters' })
    )

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/search?starred=1&sort=relevance'
    )
  })

  it('closes the advanced search without searching on Escape', async () => {
    await renderField(makeServer())
    await userEvent.click(combobox())
    await userEvent.click(
      screen.getByRole('button', { name: 'Advanced search' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Advanced search' })
    expect(
      within(dialog).getByRole('button', { name: 'Folder All email' })
    ).toBeVisible()

    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/mailbox/mailbox-inbox'
    )
  })

  it('puts "Clear filter" beside the title of the advanced search on a phone', async () => {
    mockViewport({ width: 390 })
    try {
      await renderField(makeServer())
      await userEvent.click(combobox())
      await userEvent.click(
        screen.getByRole('button', { name: 'Advanced search' })
      )

      // Named by its title alone
      const dialog = screen.getByRole('dialog', { name: 'Advanced search' })
      const clear = within(dialog).getByRole('button', { name: 'Clear filter' })
      const heading = within(dialog).getByRole('heading', {
        name: 'Advanced search'
      })
      // In the title row, not in the actions at the bottom
      expect(heading.parentElement?.parentElement).toBe(clear.parentElement)
      expect(
        within(dialog).getByRole('button', { name: 'Cancel' })
      ).toBeVisible()
    } finally {
      resetViewport()
    }
  })
})
