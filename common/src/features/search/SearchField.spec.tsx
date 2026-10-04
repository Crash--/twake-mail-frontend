import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { useLocation } from 'react-router'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { CONTACT_AUTOCOMPLETE_CAPABILITY } from '@common/jmap/linagoraMethods'
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
    <>
      <SearchField initialFilter={initialFilter} />
      <Location />
    </>,
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
      ? { [CONTACT_AUTOCOMPLETE_CAPABILITY]: { minInputLength: 2 } }
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
      within(listbox).getByRole('option', { name: 'Search for "report"' })
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
    await screen.findByRole('option', { name: 'Search for "bob"' })

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
    await userEvent.selectOptions(
      within(dialog).getByLabelText('Sort by'),
      'Oldest'
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

  it('closes the advanced search without searching on Cancel', async () => {
    await renderField(makeServer())
    await userEvent.click(combobox())
    await userEvent.click(
      screen.getByRole('button', { name: 'Advanced search' })
    )
    const dialog = screen.getByRole('dialog', { name: 'Advanced search' })
    // A native select always shows a value: its label stays above it
    expect(within(dialog).getByLabelText('Folder')).toHaveDisplayValue(
      'All email'
    )

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' })
    )

    expect(screen.queryByRole('dialog')).toBe(null)
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
