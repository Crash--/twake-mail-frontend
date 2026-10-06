import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { SupportedLanguage } from '@common/i18n/languages'
import {
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeMailbox,
  makeTeamMailboxes
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { MailboxTree } from './MailboxTree'
import { SidebarSectionsProvider } from './SidebarSectionsProvider'

function renderTree(
  route = '/mailbox/mailbox-inbox',
  lang: SupportedLanguage = 'en',
  extra: ReturnType<typeof makeMailbox>[] = []
): ReturnType<typeof renderWithProviders> {
  const jmapServer = makeFakeJmapServer({
    mailboxes: [
      ...makeDefaultMailboxes(),
      ...extra,
      makeMailbox({ id: 'work', name: 'Work', unreadEmails: 4 }),
      makeMailbox({ id: 'clients', name: 'Clients', parentId: 'work' }),
      makeMailbox({ id: 'acme', name: 'ACME', parentId: 'clients' })
    ]
  })
  return renderWithProviders(
    <SidebarSectionsProvider>
      <MailboxTree />
    </SidebarSectionsProvider>,
    {
      route,
      path: '/mailbox/:mailboxId',
      withJmapSession: true,
      jmapServer,
      lang
    }
  )
}

function folderNames(): string[] {
  return screen
    .getAllByTestId('mailbox-item-name')
    .map(name => name.textContent)
}

function folder(name: string): HTMLElement {
  const item = screen
    .getAllByTestId('mailbox-item')
    .find(
      candidate =>
        within(candidate).getByTestId('mailbox-item-name').textContent === name
    )
  if (!item) throw new Error(`No folder named ${name}`)
  return item
}

describe('MailboxTree', () => {
  it('collapses and expands the Folders section by its title', async () => {
    renderTree()
    await screen.findAllByTestId('mailbox-item')

    const toggle = screen.getByRole('button', { name: 'Folders' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // The folders of the user fold, the system ones stay
    expect(screen.queryByTestId('mailbox-folders-tree')).not.toBeVisible()
    expect(screen.getByTestId('mailbox-tree')).toBeVisible()
    // Its actions stay
    expect(screen.getByTestId('add-new-folder-button')).toBeVisible()

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('mailbox-folders-tree')).toBeVisible()
  })

  it('draws rows of skeleton, busy and hidden to screen readers, while the folders load', async () => {
    const server = makeFakeJmapServer({ mailboxes: makeDefaultMailboxes() })
    const release = server.holdRequests('Mailbox/get')
    renderWithProviders(
      <SidebarSectionsProvider>
        <MailboxTree />
      </SidebarSectionsProvider>,
      {
        route: '/mailbox/mailbox-inbox',
        path: '/mailbox/:mailboxId',
        withJmapSession: true,
        jmapServer: server
      }
    )

    const skeleton = await screen.findByTestId('mailbox-tree-loading')
    expect(skeleton).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByRole('tree', { name: 'Mailboxes' })).toBe(null)

    release()

    expect(await screen.findByRole('tree', { name: 'Mailboxes' })).toBeVisible()
    expect(screen.queryByTestId('mailbox-tree-loading')).toBe(null)
  })

  it('holds the system folders and the folders of the user in two trees', async () => {
    renderTree()
    await screen.findAllByTestId('mailbox-item')

    const system = screen.getByRole('tree', { name: 'Mailboxes' })
    const folders = screen.getByRole('tree', { name: 'Folders' })
    expect(system).toBe(screen.getByTestId('mailbox-tree'))
    expect(folders).toBe(screen.getByTestId('mailbox-folders-tree'))
    expect(within(system).getByText('Inbox')).toBeInTheDocument()
    expect(within(system).queryByText('Work')).toBeNull()
    expect(within(folders).getByText('Work')).toBeInTheDocument()
    expect(within(folders).queryByText('Inbox')).toBeNull()
  })

  it('shows Clean on the Spam with emails, and nowhere else', async () => {
    renderTree('/mailbox/mailbox-inbox', 'en', [
      makeMailbox({
        id: 'mailbox-spam',
        name: 'Spam',
        role: 'junk',
        totalEmails: 3
      })
    ])
    await screen.findAllByTestId('mailbox-item')

    const buttons = screen.getAllByTestId('mailbox-clean-button')
    expect(buttons).toHaveLength(1)
    expect(within(folder('Spam')).getByRole('button', { name: 'Clean' })).toBe(
      buttons[0]
    )
  })

  it('says a hidden folder is hidden without a coloured badge', async () => {
    renderTree('/mailbox/mailbox-inbox', 'en', [
      makeMailbox({ id: 'rare', name: 'Rarely used', isSubscribed: false })
    ])
    await screen.findAllByTestId('mailbox-item')
    await userEvent.click(screen.getByTestId('show-hidden-folders-button'))

    const row = folder('Rarely used')
    expect(row).toHaveAttribute('data-hidden', 'true')
    expect(within(row).getByTestId('mailbox-item-hidden')).toHaveTextContent(
      'hidden'
    )
    // The name keeps its room: nothing visible follows it
    expect(within(row).getByTestId('mailbox-item-name')).toHaveTextContent(
      'Rarely used'
    )
  })

  it('lists the system folders first, with their translated name', async () => {
    renderTree('/mailbox/mailbox-inbox', 'fr')

    await screen.findAllByTestId('mailbox-item')

    expect(folderNames()).toEqual([
      'Boîte de réception',
      'Favoris',
      'Brouillons',
      'Envoyés',
      'Corbeille',
      'Indésirables',
      'Work'
    ])
    expect(folder('Boîte de réception')).toHaveAttribute(
      'data-mailbox-role',
      'inbox'
    )
    expect(folder('Work')).not.toHaveAttribute('data-mailbox-role')
  })

  it('shows the unread count of the folders that have unread emails', async () => {
    renderTree()

    await screen.findAllByTestId('mailbox-item')

    expect(
      within(folder('Inbox')).getByTestId('mailbox-unread-count')
    ).toHaveTextContent('2')
    expect(within(folder('Sent')).queryByTestId('mailbox-unread-count')).toBe(
      null
    )
  })

  it('marks the folder of the route as current and opens another', async () => {
    renderTree('/mailbox/mailbox-sent')

    await screen.findAllByTestId('mailbox-item')
    expect(folder('Sent')).toHaveAttribute('aria-current', 'page')
    expect(folder('Inbox')).not.toHaveAttribute('aria-current')

    await userEvent.click(within(folder('Trash')).getByRole('link'))

    expect(folder('Trash')).toHaveAttribute('aria-current', 'page')
    expect(folder('Sent')).not.toHaveAttribute('aria-current')
  })

  it('expands and collapses the subfolders', async () => {
    renderTree()

    await screen.findAllByTestId('mailbox-item')
    expect(folder('Work')).toHaveAttribute('aria-expanded', 'false')
    expect(folderNames()).not.toContain('Clients')

    await userEvent.click(
      within(folder('Work')).getByRole('button', { name: 'Expand' })
    )

    expect(folder('Work')).toHaveAttribute('aria-expanded', 'true')
    expect(folder('Clients')).toHaveAttribute('aria-level', '2')
    expect(folderNames()).not.toContain('ACME')

    await userEvent.click(
      within(folder('Work')).getByRole('button', { name: 'Collapse' })
    )

    expect(folderNames()).not.toContain('Clients')
  })

  it('expands the folders leading to the selected one', async () => {
    renderTree('/mailbox/acme')

    await screen.findAllByTestId('mailbox-item')

    expect(folder('ACME')).toHaveAttribute('aria-current', 'page')
    expect(folder('ACME')).toHaveAttribute('aria-level', '3')
  })

  it('has no slot for an expand arrow, which follows the name of a folder with subfolders', async () => {
    renderTree()

    await screen.findAllByTestId('mailbox-item')

    expect(screen.queryByTestId('mailbox-toggle-slot')).toBe(null)
    expect(within(folder('Inbox')).queryByTestId('mailbox-expand-button')).toBe(
      null
    )
    expect(
      within(folder('Work')).getByTestId('mailbox-expand-button')
    ).toHaveAccessibleName('Expand')
  })

  it('reaches the expand arrow with Tab and toggles it with Enter and Space', async () => {
    renderTree()
    await screen.findAllByTestId('mailbox-item')

    act(() => {
      folder('Work').focus()
    })
    await userEvent.tab()
    expect(
      within(folder('Work')).getByRole('button', { name: 'Expand' })
    ).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    expect(folder('Work')).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard(' ')
    expect(folder('Work')).toHaveAttribute('aria-expanded', 'false')
  })

  it('keeps the actions of a folder in the tab order, named', async () => {
    renderTree()
    await screen.findAllByTestId('mailbox-item')

    const more = within(folder('Sent')).getByRole('button', {
      name: 'Actions on Sent'
    })
    act(() => {
      folder('Sent').focus()
    })
    await userEvent.tab()
    expect(more).toHaveFocus()
  })

  describe('keyboard', () => {
    it('has one tab stop per tree: the selected folder, else the first', async () => {
      renderTree('/mailbox/mailbox-sent')
      await screen.findAllByTestId('mailbox-item')

      const stops = screen
        .getAllByRole('treeitem')
        .filter(item => item.getAttribute('tabindex') === '0')
      expect(stops.map(stop => stop.textContent)).toEqual([
        expect.stringContaining('Sent'),
        expect.stringContaining('Work')
      ])
      // The links are for the pointer, the buttons of the other rows are out
      expect(within(folder('Inbox')).getByRole('link')).toHaveAttribute(
        'tabindex',
        '-1'
      )
      expect(
        within(folder('Drafts')).getByRole('button', {
          name: 'Actions on Drafts'
        })
      ).toHaveAttribute('tabindex', '-1')
    })

    it('goes down and up the visible folders, Starred after the Inbox subtree', async () => {
      renderTree('/mailbox/news', 'en', [
        makeMailbox({ id: 'news', name: 'News', parentId: 'mailbox-inbox' })
      ])
      await screen.findAllByTestId('mailbox-item')
      act(() => {
        folder('Inbox').focus()
      })

      await userEvent.keyboard('{ArrowDown}')
      expect(folder('News')).toHaveFocus()
      await userEvent.keyboard('{ArrowDown}')
      expect(folder('Starred')).toHaveFocus()
      await userEvent.keyboard('{ArrowUp}{ArrowUp}')
      expect(folder('Inbox')).toHaveFocus()
      await userEvent.keyboard('{End}')
      expect(folder('Spam')).toHaveFocus()
      await userEvent.keyboard('{Home}')
      expect(folder('Inbox')).toHaveFocus()
    })

    it('expands with ArrowRight, goes to the first child, then back to the parent', async () => {
      renderTree()
      await screen.findAllByTestId('mailbox-item')
      act(() => {
        folder('Work').focus()
      })

      await userEvent.keyboard('{ArrowRight}')
      expect(folder('Work')).toHaveAttribute('aria-expanded', 'true')
      expect(folder('Work')).toHaveFocus()
      await userEvent.keyboard('{ArrowRight}')
      expect(folder('Clients')).toHaveFocus()
      expect(folder('Clients')).toHaveAttribute('aria-level', '2')
      expect(folder('Clients')).toHaveAttribute('aria-posinset', '1')
      expect(folder('Clients')).toHaveAttribute('aria-setsize', '1')
      await userEvent.keyboard('{ArrowLeft}')
      expect(folder('Work')).toHaveFocus()
      await userEvent.keyboard('{ArrowLeft}')
      expect(folder('Work')).toHaveAttribute('aria-expanded', 'false')
      expect(folderNames()).not.toContain('Clients')
    })

    it('opens the folder with Enter', async () => {
      renderTree()
      await screen.findAllByTestId('mailbox-item')
      act(() => {
        folder('Sent').focus()
      })

      await userEvent.keyboard('{Enter}')

      expect(folder('Sent')).toHaveAttribute('aria-current', 'page')
      expect(folder('Sent')).toHaveAttribute('aria-selected', 'true')
      expect(folder('Inbox')).toHaveAttribute('aria-selected', 'false')
    })

    it('opens the menu of the focused folder with Shift+F10 and the menu key', async () => {
      renderTree()
      await screen.findAllByTestId('mailbox-item')
      act(() => {
        folder('Sent').focus()
      })

      await userEvent.keyboard('{Shift>}{F10}{/Shift}')

      expect(await screen.findByRole('menu')).toBeVisible()
      await userEvent.keyboard('{Escape}')
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null)
      })
      expect(folder('Sent')).toHaveFocus()

      await userEvent.keyboard('{ContextMenu}')
      expect(await screen.findByRole('menu')).toBeVisible()
    })

    it('names a folder by its link, not by the buttons of the row', async () => {
      renderTree()
      await screen.findAllByTestId('mailbox-item')

      expect(
        screen.getByRole('treeitem', { name: 'Work 4' })
      ).toBeInTheDocument()
    })
  })

  it('says the unread count in the name of the link, the badge being decoration', async () => {
    renderTree()
    await screen.findAllByTestId('mailbox-item')

    expect(
      within(folder('Work')).getByRole('link', { name: 'Work 4' })
    ).toBeInTheDocument()
    expect(
      within(folder('Work')).getByTestId('mailbox-unread-count')
    ).toHaveTextContent('4')
  })

  it('puts Starred after the whole subtree of an expanded Inbox', async () => {
    const jmapServer = makeFakeJmapServer({
      mailboxes: [
        ...makeDefaultMailboxes(),
        makeMailbox({ id: 'news', name: 'News', parentId: 'mailbox-inbox' }),
        makeMailbox({ id: 'tech', name: 'Tech', parentId: 'news' })
      ]
    })
    renderWithProviders(<MailboxTree />, {
      route: '/mailbox/tech',
      path: '/mailbox/:mailboxId',
      withJmapSession: true,
      jmapServer
    })

    await screen.findAllByTestId('mailbox-item')

    expect(folderNames()).toEqual([
      'Inbox',
      'News',
      'Tech',
      'Starred',
      'Drafts',
      'Sent',
      'Trash',
      'Spam'
    ])
    const items = screen.getAllByTestId('mailbox-item')
    const levels = items.map(item => item.getAttribute('aria-level'))
    expect(levels).toEqual(['1', '2', '3', '1', '1', '1', '1', '1'])
    const starred = folder('Starred')
    expect(starred).toHaveAttribute('aria-level', '1')
    expect(starred).toHaveAttribute('aria-posinset', '2')
    expect(starred).toHaveAttribute('aria-setsize', '6')
    expect(folder('Drafts')).toHaveAttribute('aria-posinset', '3')
    expect(folder('Drafts')).toHaveAttribute('aria-setsize', '6')
    expect(folder('News')).toHaveAttribute('aria-posinset', '1')
    expect(folder('News')).toHaveAttribute('aria-setsize', '1')
  })

  it('keeps Starred right after a collapsed Inbox', async () => {
    const jmapServer = makeFakeJmapServer({
      mailboxes: [
        ...makeDefaultMailboxes(),
        makeMailbox({ id: 'news', name: 'News', parentId: 'mailbox-inbox' })
      ]
    })
    renderWithProviders(<MailboxTree />, {
      route: '/mailbox/mailbox-sent',
      path: '/mailbox/:mailboxId',
      withJmapSession: true,
      jmapServer
    })

    await screen.findAllByTestId('mailbox-item')

    expect(folderNames().slice(0, 3)).toEqual(['Inbox', 'Starred', 'Drafts'])
  })

  it('says the address of a team mailbox on its root, not on its folders', async () => {
    renderWithProviders(<MailboxTree />, {
      route: '/mailbox/team-inbox',
      path: '/mailbox/:mailboxId',
      withJmapSession: true,
      jmapServer: makeFakeJmapServer({
        mailboxes: [...makeDefaultMailboxes(), ...makeTeamMailboxes()]
      })
    })

    const section = await screen.findByTestId('team-mailboxes-section')
    expect(within(section).getAllByTestId('mailbox-item-address')).toHaveLength(
      1
    )
    expect(
      within(section).getByTestId('mailbox-item-address')
    ).toHaveTextContent('team@example.com')
  })

  describe('Action required', () => {
    const AI = { 'com:linagora:params:jmap:aibot': {} }
    const SETTINGS = {
      'com:linagora:params:jmap:settings': { readOnlyProperties: [] }
    }

    function renderTree(
      capabilities: Record<string, unknown>,
      settings: Record<string, string>
    ): void {
      renderWithProviders(<MailboxTree />, {
        route: '/mailbox/mailbox-sent',
        path: '/mailbox/:mailboxId',
        withJmapSession: true,
        jmapServer: makeFakeJmapServer({ capabilities, settings })
      })
    }

    it('comes after Starred with the AI capability and the categorisation on', async () => {
      renderTree(
        { ...AI, ...SETTINGS },
        { 'ai.label-categorization.enabled': 'true' }
      )

      expect(await screen.findByText('Action required')).toBeVisible()
      expect(folderNames().slice(0, 4)).toEqual([
        'Inbox',
        'Starred',
        'Action required',
        'Drafts'
      ])
      expect(folder('Action required')).toHaveAttribute('aria-posinset', '3')
      expect(folder('Drafts')).toHaveAttribute('aria-posinset', '4')
      expect(folder('Action required')).toHaveAttribute('aria-setsize', '7')
    })

    it.each([
      ['the categorisation is off', { ...AI, ...SETTINGS }, {}],
      [
        'the server has no AI capability',
        SETTINGS,
        { 'ai.label-categorization.enabled': 'true' }
      ]
    ])('is not there when %s', async (_name, capabilities, settings) => {
      renderTree(capabilities, settings)

      await screen.findAllByTestId('mailbox-item')
      await waitFor(() => {
        expect(folderNames()).toContain('Starred')
      })
      expect(screen.queryByText('Action required')).toBe(null)
    })
  })
})
