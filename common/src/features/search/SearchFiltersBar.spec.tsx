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
    const options = within(picker).getAllByRole('option')
    expect(options[0]).toHaveTextContent('All email')
    expect(options[0]).toHaveAttribute('aria-disabled', 'true')
    expect(options[1]).toHaveTextContent('All Email, trash & spam')

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
})
