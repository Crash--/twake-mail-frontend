import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { SupportedLanguage } from '@common/i18n/languages'
import {
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeMailbox
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { MailboxTree } from './MailboxTree'

function renderTree(
  route = '/mailbox/mailbox-inbox',
  lang: SupportedLanguage = 'en'
): ReturnType<typeof renderWithProviders> {
  const jmapServer = makeFakeJmapServer({
    mailboxes: [
      ...makeDefaultMailboxes(),
      makeMailbox({ id: 'work', name: 'Work', unreadEmails: 4 }),
      makeMailbox({ id: 'clients', name: 'Clients', parentId: 'work' }),
      makeMailbox({ id: 'acme', name: 'ACME', parentId: 'clients' })
    ]
  })
  return renderWithProviders(<MailboxTree />, {
    route,
    path: '/mailbox/:mailboxId',
    withJmapSession: true,
    jmapServer,
    lang
  })
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
  it('lists the system folders first, with their translated name', async () => {
    renderTree('/mailbox/mailbox-inbox', 'fr')

    await screen.findAllByTestId('mailbox-item')

    expect(folderNames()).toEqual([
      'Boîte de réception',
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

  it('keeps no room for an expand arrow when no folder has subfolders', async () => {
    const jmapServer = makeFakeJmapServer({
      mailboxes: [
        ...makeDefaultMailboxes(),
        makeMailbox({ id: 'work', name: 'Work' })
      ]
    })
    renderWithProviders(<MailboxTree />, {
      route: '/mailbox/mailbox-inbox',
      path: '/mailbox/:mailboxId',
      withJmapSession: true,
      jmapServer
    })

    await screen.findAllByTestId('mailbox-item')

    expect(screen.queryByTestId('mailbox-toggle-slot')).toBe(null)
  })

  it('aligns every folder on the expand arrows when one has subfolders', async () => {
    renderTree()

    await screen.findAllByTestId('mailbox-item')

    expect(
      within(folder('Inbox')).queryByTestId('mailbox-toggle-slot')
    ).toBeInTheDocument()
    expect(
      within(folder('Work')).queryByTestId('mailbox-toggle-slot')
    ).toBeInTheDocument()
  })
})
