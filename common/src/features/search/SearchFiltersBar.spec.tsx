import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MailboxPickerProvider } from '@common/features/mailbox/MailboxPickerProvider'
import {
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeMailbox
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EMPTY_SEARCH_FILTER, type SearchFilter } from './searchFilter'
import { SearchFiltersBar } from './SearchFiltersBar'

function renderBar(filter: SearchFilter = EMPTY_SEARCH_FILTER): jest.Mock {
  const onChange = jest.fn()
  renderWithProviders(
    <MailboxPickerProvider>
      <SearchFiltersBar filter={filter} onChange={onChange} />
    </MailboxPickerProvider>,
    {
      withJmapSession: true,
      jmapServer: makeFakeJmapServer({
        capabilities: {
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
          makeMailbox({ id: 'work', name: 'Work' })
        ]
      })
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

  it('picks the senders in the contact view of tmail-flutter', async () => {
    const onChange = renderBar({ ...EMPTY_SEARCH_FILTER, from: ['me@x.org'] })

    await userEvent.click(await screen.findByRole('button', { name: 'From' }))

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

    await userEvent.click(await screen.findByRole('button', { name: 'To' }))
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
})
