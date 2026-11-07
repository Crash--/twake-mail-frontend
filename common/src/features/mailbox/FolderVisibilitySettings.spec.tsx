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
  makeMailbox,
  makeTeamMailboxes,
  type FakeJmapServer
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

function renderSettings(server: FakeJmapServer): void {
  renderWithProviders(
    <MailboxPickerProvider>
      <FolderActionsProvider>
        <FolderVisibilitySettings section={visibilitySection()} />
      </FolderActionsProvider>
    </MailboxPickerProvider>,
    { jmapServer: server, withJmapSession: true }
  )
}

describe('FolderVisibilitySettings', () => {
  it('lists the system folders, then folds the folders of the user and the team mailboxes under "Folders", as tmail-flutter', async () => {
    renderSettings(
      makeFakeJmapServer({
        mailboxes: [
          ...makeDefaultMailboxes(),
          makeMailbox({ id: 'work', name: 'Work', isSubscribed: true }),
          makeMailbox({
            id: 'clients',
            name: 'Clients',
            parentId: 'work',
            isSubscribed: true
          }),
          ...makeTeamMailboxes({ address: 'sales@example.com' })
        ]
      })
    )

    await screen.findByText('Work')
    const system = screen.getByTestId('folder-visibility-personal')
    expect(within(system).getByText('Inbox')).toBeVisible()
    expect(within(system).queryByText('Work')).toBe(null)
    expect(
      within(screen.getByTestId('folder-visibility-team')).getByTestId(
        'folder-visibility-address'
      )
    ).toHaveTextContent('sales@example.com')

    // Subfolders stay folded until their folder is expanded
    expect(screen.queryByText('Clients')).toBe(null)
    const expand = within(row('Work')).getByRole('button', { name: 'Expand' })
    expect(expand).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(expand)
    expect(within(row('Work')).getByText('Clients')).toBeVisible()
    expect(
      within(row('Work')).getByRole('button', { name: 'Collapse' })
    ).toHaveAttribute('aria-expanded', 'true')

    expect(screen.getByRole('region', { name: 'Mailboxes' })).toContainElement(
      system
    )
    expect(
      within(screen.getByRole('list', { name: 'Personal folders' })).getByText(
        'Work'
      )
    ).toBeVisible()

    // "Personal folders" and "Team-mailboxes" fold on their own
    const team = screen.getByRole('button', { name: 'Team-mailboxes' })
    await userEvent.click(team)
    expect(team).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('folder-visibility-team')).toBe(null)
    expect(screen.getByText('Work')).toBeVisible()
    await userEvent.click(team)

    // "Folders" folds the folders of the user and the team mailboxes
    const folders = screen.getByRole('button', { name: 'Folders' })
    expect(folders).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(folders)
    expect(folders).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Work')).toBe(null)
    expect(screen.queryByTestId('folder-visibility-team')).toBe(null)
    expect(within(system).getByText('Inbox')).toBeVisible()
  })

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
    renderSettings(server)

    await screen.findByText('Work')
    // System folders stay
    expect(within(row('INBOX')).queryByTestId('folder-visibility-toggle')).toBe(
      null
    )
    expect(within(row('INBOX')).getByText('Always visible')).toBeVisible()

    const toggle = within(row('Work')).getByRole('button', {
      name: 'Visible: Hide Work'
    })
    expect(toggle).toHaveTextContent('Visible')
    await userEvent.click(toggle)

    await waitFor(() => {
      expect(server.mailboxes.find(m => m.id === 'work')?.isSubscribed).toBe(
        false
      )
    })
    expect(server.mailboxes.find(m => m.id === 'clients')?.isSubscribed).toBe(
      false
    )
    await userEvent.click(
      await within(row('Work')).findByRole('button', {
        name: 'Hidden: Show Work'
      })
    )
    await waitFor(() => {
      expect(server.mailboxes.find(m => m.id === 'work')?.isSubscribed).toBe(
        true
      )
    })
  })
})
