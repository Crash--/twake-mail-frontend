import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { FolderActionsProvider } from '@common/features/mailboxActions/FolderActionsProvider'
import {
  SETTINGS_SECTIONS,
  type SettingsSection
} from '@common/features/settings/sections'
import {
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeMailbox
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { FolderVisibilitySettings } from './FolderVisibilitySettings'
import { MailboxPickerProvider } from './MailboxPickerProvider'

function visibilitySection(): SettingsSection {
  const section = SETTINGS_SECTIONS.find(({ id }) => id === 'folder-visibility')
  if (!section) throw new Error('No Folder visibility section')
  return section
}

function row(name: string): HTMLElement {
  const found = screen
    .getAllByTestId('folder-visibility-item')
    .find(element => element.dataset.mailboxName === name)
  if (!found) throw new Error(`No row ${name}`)
  return found
}

describe('FolderVisibilitySettings', () => {
  it('hides a folder with its subfolders, and shows it again', async () => {
    const server = makeFakeJmapServer({
      mailboxes: [
        ...makeDefaultMailboxes(),
        makeMailbox({ id: 'work', name: 'Work', isSubscribed: true }),
        makeMailbox({
          id: 'clients',
          name: 'Clients',
          parentId: 'work',
          isSubscribed: true
        })
      ]
    })
    renderWithProviders(
      <MailboxPickerProvider>
        <FolderActionsProvider>
          <FolderVisibilitySettings section={visibilitySection()} />
        </FolderActionsProvider>
      </MailboxPickerProvider>,
      { jmapServer: server, withJmapSession: true }
    )

    await screen.findByText('Work')
    // System folders stay
    expect(within(row('INBOX')).queryByTestId('folder-visibility-toggle')).toBe(
      null
    )

    await userEvent.click(
      within(row('Work')).getByRole('button', { name: 'Hide Work' })
    )

    await waitFor(() => {
      expect(server.mailboxes.find(m => m.id === 'work')?.isSubscribed).toBe(
        false
      )
    })
    expect(server.mailboxes.find(m => m.id === 'clients')?.isSubscribed).toBe(
      false
    )
    await userEvent.click(
      await within(row('Work')).findByRole('button', { name: 'Show Work' })
    )
    await waitFor(() => {
      expect(server.mailboxes.find(m => m.id === 'work')?.isSubscribed).toBe(
        true
      )
    })
  })
})
