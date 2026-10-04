import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Outlet, Route, useParams } from 'react-router'

import { MailboxPickerProvider } from '@common/features/mailbox/MailboxPickerProvider'
import { MailboxTree } from '@common/features/mailbox/MailboxTree'
import {
  makeDefaultMailboxes,
  makeEmail,
  makeFakeJmapServer,
  makeMailbox,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { FolderActionsProvider } from './FolderActionsProvider'

const TEAM = 'TeamMailbox[team@example.com]'

function Screen(): ReactElement {
  return (
    <MailboxPickerProvider>
      <FolderActionsProvider>
        <MailboxTree />
        <Outlet />
      </FolderActionsProvider>
    </MailboxPickerProvider>
  )
}

function OpenFolder(): ReactElement {
  const { mailboxId } = useParams()
  return <p>Open folder {mailboxId}</p>
}

function makeServer(): FakeJmapServer {
  return makeFakeJmapServer({
    mailboxes: [
      ...makeDefaultMailboxes(),
      makeMailbox({
        id: 'work',
        name: 'Work',
        unreadEmails: 2,
        totalEmails: 3
      }),
      makeMailbox({ id: 'clients', name: 'Clients', parentId: 'work' }),
      makeMailbox({ id: 'team', name: 'team', namespace: TEAM }),
      makeMailbox({
        id: 'team-inbox',
        name: 'INBOX',
        parentId: 'team',
        namespace: TEAM
      })
    ],
    emails: [
      makeEmail({ id: 'u1', mailboxIds: { work: true } }),
      makeEmail({ id: 'u2', mailboxIds: { work: true } }),
      makeEmail({
        id: 'r1',
        mailboxIds: { work: true },
        keywords: { $seen: true }
      }),
      makeEmail({ id: 'c1', mailboxIds: { clients: true } })
    ]
  })
}

async function renderTree(
  server: FakeJmapServer,
  route = '/mailbox/mailbox-inbox'
): Promise<void> {
  renderWithProviders(<Screen />, {
    route,
    path: '/',
    withJmapSession: true,
    jmapServer: server,
    childRoutes: <Route path="mailbox/:mailboxId" element={<OpenFolder />} />
  })
  await screen.findAllByTestId('mailbox-item')
}

function folder(name: string): HTMLElement {
  const found = screen
    .getAllByTestId('mailbox-item')
    .find(
      item => within(item).getByTestId('mailbox-item-name').textContent === name
    )
  if (!found) throw new Error(`No folder ${name}`)
  return found
}

async function openMenu(name: string): Promise<HTMLElement> {
  await userEvent.click(
    within(folder(name)).getByRole('button', { name: `Actions on ${name}` })
  )
  return screen.getByRole('menu', { name: 'Folder actions' })
}

function mailbox(
  server: FakeJmapServer,
  id: string
): ReturnType<typeof makeMailbox> | undefined {
  return server.mailboxes.find(candidate => candidate.id === id)
}

describe('Folder actions', () => {
  it('creates a folder after checking its name, then opens it', async () => {
    const server = makeServer()
    await renderTree(server)

    await userEvent.click(screen.getByRole('button', { name: 'New folder' }))
    const dialog = screen.getByRole('dialog', { name: 'Create a New Folder' })
    const field = within(dialog).getByRole('textbox', { name: 'Folder Name' })
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Create folder' })
    )
    expect(field).toHaveAccessibleDescription('Name of folder is required')
    expect(field).toHaveFocus()
    await userEvent.type(field, 'work')
    expect(field).toHaveAccessibleDescription(
      'This folder name is already taken'
    )
    await userEvent.clear(field)
    await userEvent.type(field, 'Projects{Enter}')

    expect(
      await screen.findByText(/^Open folder mailbox-created-/)
    ).toBeVisible()
    expect(folder('Projects')).toHaveAttribute('aria-current', 'page')
    expect(mailbox(server, 'mailbox-created-1')).toMatchObject({
      name: 'Projects',
      parentId: null,
      isSubscribed: true
    })
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'You successfully created Projects folder'
    )
  })

  it('creates a subfolder, elsewhere when the location changes', async () => {
    const server = makeServer()
    await renderTree(server)

    await userEvent.click(
      within(await openMenu('Work')).getByRole('menuitem', {
        name: 'New subfolder'
      })
    )
    const dialog = screen.getByRole('dialog', { name: 'Create a New Folder' })
    const location = within(dialog).getByRole('button', { name: 'Work' })
    expect(location).toHaveAccessibleDescription('Select the folder location')
    await userEvent.click(location)
    await userEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Select the folder location' })
      ).getByRole('option', { name: 'Personal folders' })
    )
    // Once the picker went
    expect(
      await within(dialog).findByRole('button', { name: 'Personal folders' })
    ).toBeVisible()
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Folder Name' }),
      'Top{Enter}'
    )

    await waitFor(() => {
      expect(mailbox(server, 'mailbox-created-1')).toMatchObject({
        name: 'Top',
        parentId: null
      })
    })
  })

  it('renames a folder from its context menu', async () => {
    const server = makeServer()
    await renderTree(server)

    fireEvent.contextMenu(folder('Work'), { clientX: 20, clientY: 20 })
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Rename folder' })
    )
    const field = within(
      screen.getByRole('dialog', { name: 'Rename folder' })
    ).getByRole('textbox', { name: 'Folder Name' })
    expect(field).toHaveValue('Work')
    await userEvent.clear(field)
    await userEvent.type(field, 'Job{Enter}')

    await waitFor(() => {
      expect(mailbox(server, 'work')?.name).toBe('Job')
    })
    expect(await screen.findByText('Job')).toBeVisible()
  })

  it('moves a folder to the top level, and back with Undo', async () => {
    const server = makeServer()
    await renderTree(server, '/mailbox/clients')

    await userEvent.click(
      within(await openMenu('Clients')).getByRole('menuitem', {
        name: 'Move folder'
      })
    )
    const picker = screen.getByRole('dialog', { name: 'Move folder' })
    expect(
      within(picker).getByRole('option', { name: 'Clients' })
    ).toHaveAttribute('aria-disabled', 'true')
    expect(within(picker).queryByRole('option', { name: 'team' })).toBe(null)
    await userEvent.click(
      within(picker).getByRole('option', { name: 'All folders' })
    )

    await waitFor(() => {
      expect(mailbox(server, 'clients')?.parentId).toBe(null)
    })
    const toast = await screen.findByTestId('toast')
    expect(toast).toHaveTextContent('Moved to All folders')
    await userEvent.click(
      await within(toast).findByRole('button', { name: 'Undo' })
    )
    await waitFor(() => {
      expect(mailbox(server, 'clients')?.parentId).toBe('work')
    })
  })

  it('deletes a folder with its subfolders and emails, and leaves it for the Inbox', async () => {
    const server = makeServer()
    await renderTree(server, '/mailbox/work')

    await userEvent.click(
      within(await openMenu('Work')).getByRole('menuitem', {
        name: 'Delete folder'
      })
    )
    const dialog = screen.getByRole('dialog', { name: 'Delete folders' })
    expect(dialog).toHaveTextContent('"Work" folder and all of the sub-folders')
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )

    expect(await screen.findByText('Open folder mailbox-inbox')).toBeVisible()
    expect(server.mailboxes.map(item => item.id)).not.toEqual(
      expect.arrayContaining(['work', 'clients'])
    )
    expect(server.emails).toEqual([])
    const destroyed = server.requests.flatMap(({ methodCalls }) =>
      methodCalls
        .filter(([name]) => name === 'Mailbox/set')
        .map(([, args]) => args.destroy)
    )
    expect(destroyed).toEqual([['clients'], ['work']])
  })

  it('deletes the subfolders another client created since the tree loaded', async () => {
    const server = makeServer()
    await renderTree(server)
    // Not pushed: the tree does not know it
    server.mailboxes.push(
      makeMailbox({ id: 'fresh', name: 'Fresh', parentId: 'clients' })
    )

    await userEvent.click(
      within(await openMenu('Work')).getByRole('menuitem', {
        name: 'Delete folder'
      })
    )
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Delete folders' })).getByRole(
        'button',
        { name: 'Delete' }
      )
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Folders deleted'
    )
    expect(server.mailboxes.map(item => item.id)).not.toEqual(
      expect.arrayContaining(['fresh', 'clients', 'work'])
    )
  })

  it('marks every email of a folder read', async () => {
    const server = makeServer()
    await renderTree(server)

    await userEvent.click(
      within(await openMenu('Work')).getByRole('menuitem', {
        name: 'Mark as read'
      })
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You’ve marked all messages in "Work" as read'
    )
    expect(
      server.emails
        .filter(email => 'work' in email.mailboxIds)
        .every(email => '$seen' in email.keywords)
    ).toBe(true)
  })

  it('hides a folder and its subfolders, then shows it on demand', async () => {
    const server = makeServer()
    await renderTree(server)

    await userEvent.click(
      within(await openMenu('Work')).getByRole('menuitem', {
        name: 'Hide folder'
      })
    )
    await waitFor(() => {
      expect(screen.queryByText('Work')).toBe(null)
    })
    expect(mailbox(server, 'work')?.isSubscribed).toBe(false)
    expect(mailbox(server, 'clients')?.isSubscribed).toBe(false)

    const toggle = screen.getByRole('button', { name: 'Show hidden folders' })
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(folder('Work')).getByTestId('mailbox-item-hidden')
    ).toHaveTextContent('hidden')
    await userEvent.click(
      within(await openMenu('Work')).getByRole('menuitem', {
        name: 'Show folder'
      })
    )

    await waitFor(() => {
      expect(mailbox(server, 'work')?.isSubscribed).toBe(true)
    })
    // As tmail-flutter: its ancestors show too, not its subfolders
    expect(mailbox(server, 'clients')?.isSubscribed).toBe(false)
  })

  it('lists team mailboxes apart, with the actions their rights allow', async () => {
    const server = makeServer()
    const rights = {
      ...makeMailbox({ id: 'x', name: 'x' }).myRights,
      mayCreateChild: false,
      mayRename: false,
      mayDelete: false
    }
    server.mailboxes.forEach(item => {
      if (item.namespace === TEAM) item.myRights = rights
    })
    await renderTree(server)

    const section = screen.getByTestId('team-mailboxes-section')
    expect(
      within(section).getByRole('heading', { name: 'Team-mailboxes' })
    ).toBeVisible()
    expect(
      within(section).getByRole('tree', { name: 'Team-mailboxes' })
    ).toBeVisible()
    const menu = await openMenu('team')
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent)
    ).toEqual(['Hide folder'])
  })
})
