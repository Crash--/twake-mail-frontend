import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MailboxPickerProvider } from '@common/features/mailbox/MailboxPickerProvider'
import {
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeMailbox,
  makeTeamMailboxes
} from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeLabels
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EMPTY_SEARCH_FILTER, type SearchFilter } from './searchFilter'
import { SearchFiltersBar } from './SearchFiltersBar'

function renderBar(filter: SearchFilter = EMPTY_SEARCH_FILTER): jest.Mock {
  const onChange = jest.fn()
  const server = makeFakeJmapServer({
    capabilities: {
      ...FAKE_LINAGORA_CAPABILITIES,
      'com:linagora:params:jmap:contact:autocomplete': {
        minInputLength: 1
      }
    },
    contacts: [
      {
        id: 'c1',
        firstname: 'Zelda',
        surname: 'Contact',
        emailAddress: 'zelda@example.com'
      }
    ],
    mailboxes: [
      ...makeDefaultMailboxes(),
      makeMailbox({ id: 'work', name: 'Work' }),
      ...makeTeamMailboxes()
    ]
  })
  installFakeLabels(server, [
    { id: 'design', displayName: 'Design', keyword: 'design', color: '#2196F3' }
  ])
  renderWithProviders(
    <MailboxPickerProvider>
      <SearchFiltersBar filter={filter} onChange={onChange} />
    </MailboxPickerProvider>,
    {
      withJmapSession: true,
      jmapServer: server
    }
  )
  return onChange
}

describe('SearchFiltersBar', () => {
  it('picks the folder in the destination picker of tmail-flutter', async () => {
    const onChange = renderBar()

    await userEvent.click(
      await screen.findByRole('button', { name: 'All email' })
    )

    const picker = await screen.findByRole('dialog', { name: 'Select Folder' })
    // As tmail-flutter: "All email" first, the current scope; "All Email,
    // trash & spam" in a block of its own after the system folders
    const [systemList, choiceList] = within(picker).getAllByRole('listbox')
    if (systemList === undefined || choiceList === undefined) {
      throw new Error('The blocks of the picker are missing')
    }
    const system = within(systemList).getAllByRole('option')
    expect(system[0]).toHaveTextContent('All email')
    expect(system[0]).toHaveAttribute('aria-disabled', 'true')
    expect(system[1]).toHaveTextContent('Inbox')
    expect(within(choiceList).getByRole('option')).toHaveTextContent(
      'All Email, trash & spam'
    )

    await userEvent.click(within(picker).getByRole('option', { name: 'Work' }))

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_SEARCH_FILTER,
      scope: { kind: 'mailbox', mailboxId: 'work' }
    })
  })

  it('searches a whole team mailbox from its root', async () => {
    const onChange = renderBar()

    await userEvent.click(
      await screen.findByRole('button', { name: 'All email' })
    )
    const picker = await screen.findByRole('dialog', { name: 'Select Folder' })
    const root = within(picker).getByRole('option', { name: /^team/ })
    expect(root).not.toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(root)

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_SEARCH_FILTER,
      scope: { kind: 'mailbox', mailboxId: 'team' }
    })
  })

  it('names a folder of a team mailbox with its team mailbox', async () => {
    renderBar({
      ...EMPTY_SEARCH_FILTER,
      scope: { kind: 'mailbox', mailboxId: 'team-inbox' }
    })

    expect(
      await screen.findByRole('button', { name: 'team/Inbox' })
    ).toBeInTheDocument()
  })

  it('searches everywhere from the choice before the folders', async () => {
    const onChange = renderBar({
      ...EMPTY_SEARCH_FILTER,
      scope: { kind: 'mailbox', mailboxId: 'work' }
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Work' }))
    const picker = await screen.findByRole('dialog', { name: 'Select Folder' })
    await userEvent.click(
      within(picker).getByRole('option', { name: 'All Email, trash & spam' })
    )

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_SEARCH_FILTER,
      scope: { kind: 'everywhere' }
    })
  })

  it('shows the senders and recipients in their chip, as tmail-flutter', async () => {
    renderBar({
      ...EMPTY_SEARCH_FILTER,
      from: ['me@x.org', 'zelda@example.com'],
      to: ['bob@x.org']
    })

    expect(
      await screen.findByRole('button', {
        name: 'From: me@x.org, zelda@example.com'
      })
    ).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.getByRole('button', { name: 'To: bob@x.org' })).toBeTruthy()
    // Not a second, removable chip per address
    expect(screen.queryByTestId('search-filter-removable')).toBe(null)
  })

  it('picks the senders in the contact view of tmail-flutter', async () => {
    const onChange = renderBar({ ...EMPTY_SEARCH_FILTER, from: ['me@x.org'] })

    await userEvent.click(
      await screen.findByRole('button', { name: 'From: me@x.org' })
    )

    const picker = await screen.findByRole('dialog', {
      name: 'Find emails from'
    })
    // The chosen ones while nothing is typed
    expect(
      within(picker).getByRole('checkbox', { name: 'me@x.org' })
    ).toHaveAttribute('aria-checked', 'true')

    await userEvent.type(
      within(picker).getByRole('searchbox', { name: 'Enter name or email' }),
      'zel'
    )
    await userEvent.click(
      await within(picker).findByRole('checkbox', { name: /Zelda Contact/ })
    )
    await userEvent.click(within(picker).getByRole('button', { name: 'Done' }))

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_SEARCH_FILTER,
      from: ['me@x.org', 'zelda@example.com']
    })
    expect(screen.queryByRole('dialog')).toBe(null)
  })

  it('offers the address typed, and clears the recipients', async () => {
    const onChange = renderBar({ ...EMPTY_SEARCH_FILTER, to: ['me@x.org'] })

    await userEvent.click(
      await screen.findByRole('button', { name: 'To: me@x.org' })
    )
    const picker = await screen.findByRole('dialog', { name: 'Find emails to' })
    await userEvent.type(
      within(picker).getByRole('searchbox', { name: 'Enter name or email' }),
      'nobody@x.org'
    )

    expect(
      await within(picker).findByRole('checkbox', { name: 'nobody@x.org' })
    ).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(
      within(picker).getByRole('button', { name: 'Clear Filter' })
    )

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_SEARCH_FILTER, to: [] })
  })

  it('names the chip of a label filter after its label', async () => {
    renderBar({ ...EMPTY_SEARCH_FILTER, label: 'design' })

    expect(
      await screen.findByRole('button', { name: 'Design' })
    ).toHaveAttribute('data-selected', 'true')
  })

  it('writes a custom date range as the date fields, dd/mm/yyyy', async () => {
    renderBar({
      ...EMPTY_SEARCH_FILTER,
      dateRange: 'custom',
      startDate: '2026-10-14',
      endDate: '2026-10-21'
    })

    expect(
      await screen.findByRole('button', {
        name: 'From 14/10/2026 to 21/10/2026'
      })
    ).toHaveAttribute('data-selected', 'true')
  })

  it('says so when the label of the filter no longer exists', async () => {
    renderBar({ ...EMPTY_SEARCH_FILTER, label: 'deleted-label' })

    const chip = await screen.findByTestId('search-filter-labels')
    expect(chip).toHaveAccessibleName('Unknown label')
    expect(chip).toHaveAttribute('data-selected', 'true')
  })

  it('names the chip "All labels" without a label filter', async () => {
    renderBar()

    expect(
      await screen.findByTestId('search-filter-labels')
    ).toHaveAccessibleName('All labels')
  })
})
