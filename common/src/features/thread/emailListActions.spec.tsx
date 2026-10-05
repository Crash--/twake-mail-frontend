import { VirtuosoMockContext } from '@linagora/twake-mui'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { useParams } from 'react-router'

import { MailboxPickerProvider } from '@common/features/mailbox/MailboxPickerProvider'
import { MailboxTree } from '@common/features/mailbox/MailboxTree'
import { ShortcutsProvider } from '@common/features/shortcuts/ShortcutsProvider'
import {
  FAKE_ACCOUNT_ID,
  makeDefaultMailboxes,
  makeEmail,
  makeFakeJmapServer,
  makeMailbox,
  type FakeEmail,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'

import { EmailList } from './EmailList'
import { EMAIL_LIST_PAGE_SIZE } from './queries'
import { DRAGGED_EMAILS_TYPE } from './useEmailListActions'

function ListPage({
  viewportHeight = 100_000
}: {
  viewportHeight?: number
}): ReactElement {
  const { mailboxId = '' } = useParams()
  return (
    <ShortcutsProvider>
      <MailboxPickerProvider>
        <VirtuosoMockContext.Provider
          value={{ viewportHeight, itemHeight: 56 }}
        >
          <MailboxTree />
          <EmailList mailboxId={mailboxId} />
        </VirtuosoMockContext.Provider>
      </MailboxPickerProvider>
    </ShortcutsProvider>
  )
}

function makeEmails(count: number, mailboxId = 'mailbox-inbox'): FakeEmail[] {
  return Array.from({ length: count }, (_, index) =>
    makeEmail({
      id: `e${index}`,
      subject: `Email ${index}`,
      mailboxIds: { [mailboxId]: true },
      receivedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, count - index))
        .toISOString()
        .replace('.000', '')
    })
  )
}

function makeServer(emails: FakeEmail[] = makeEmails(4)): FakeJmapServer {
  return makeFakeJmapServer({
    mailboxes: [
      ...makeDefaultMailboxes(),
      makeMailbox({ id: 'mailbox-archive', name: 'Archive', role: 'archive' }),
      makeMailbox({ id: 'work', name: 'Work' })
    ],
    emails
  })
}

async function renderList(
  server: FakeJmapServer,
  mailboxId = 'mailbox-inbox'
): Promise<void> {
  renderWithProviders(<ListPage />, {
    route: `/mailbox/${mailboxId}`,
    path: '/mailbox/:mailboxId',
    withJmapSession: true,
    jmapServer: server
  })
  await screen.findAllByTestId('email-list-item')
  await screen.findAllByTestId('mailbox-item')
}

function row(subject: string): HTMLElement {
  const found = screen
    .getAllByTestId('email-list-item')
    .find(
      item =>
        within(item).getByTestId('email-list-item-subject').textContent ===
        subject
    )
  if (!found) throw new Error(`No row ${subject}`)
  return found
}

function checkbox(subject: string): HTMLElement {
  return within(row(subject)).getByRole('checkbox', {
    name: `Select ${subject}`
  })
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

function emailSets(server: FakeJmapServer): Record<string, unknown>[] {
  return server.requests.flatMap(({ methodCalls }) =>
    methodCalls.filter(([name]) => name === 'Email/set').map(([, args]) => args)
  )
}

describe('Acting on emails of the list', () => {
  listEmailsOneByOne()

  it('selects emails one by one and by range, then acts on them at once', async () => {
    const server = makeServer()
    await renderList(server)
    const user = userEvent.setup()

    await user.click(checkbox('Email 0'))
    await user.keyboard('{Shift>}')
    await user.click(checkbox('Email 2'))
    await user.keyboard('{/Shift}')

    const toolbar = screen.getByRole('region', { name: 'Selection actions' })
    expect(within(toolbar).getByRole('status')).toHaveTextContent('3 selected')
    expect(checkbox('Email 1')).toBeChecked()
    expect(checkbox('Email 3')).not.toBeChecked()

    await userEvent.click(
      within(toolbar).getByRole('button', { name: 'Mark as read' })
    )

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Selection actions' })).toBe(
        null
      )
    })
    expect(emailSets(server)).toEqual([
      {
        accountId: FAKE_ACCOUNT_ID,
        update: {
          e0: { 'keywords/$seen': true },
          e1: { 'keywords/$seen': true },
          e2: { 'keywords/$seen': true }
        }
      }
    ])
    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You’ve marked messages as "Read"'
    )
  })

  it('selects the loaded emails with Ctrl+A, and clears with Escape', async () => {
    await renderList(makeServer())
    within(row('Email 1')).getByRole('link').focus()

    await userEvent.keyboard('{Control>}a{/Control}')
    expect(screen.getByTestId('selection-toolbar-count')).toHaveTextContent(
      '4 selected'
    )
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByTestId('selection-toolbar')).toBe(null)
  })

  it('selects the whole folder beyond the loaded pages', async () => {
    const total = EMAIL_LIST_PAGE_SIZE + 5
    const server = makeServer(makeEmails(total))
    // Ten rows in view: the next page waits for a scroll
    renderWithProviders(<ListPage viewportHeight={560} />, {
      route: '/mailbox/mailbox-inbox',
      path: '/mailbox/:mailboxId',
      withJmapSession: true,
      jmapServer: server
    })
    await screen.findAllByTestId('email-list-item')
    // Only the first page: no scroll to load the next one
    await userEvent.click(checkbox('Email 0'))
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }))

    await userEvent.click(
      screen.getByRole('button', {
        name: `Select all ${total} messages in this folder`
      })
    )
    expect(screen.getByTestId('selection-toolbar-count')).toHaveTextContent(
      `All ${total} messages in this folder are selected`
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Archive message' })
    )

    await waitFor(() => {
      expect(
        server.emails.filter(email => 'mailbox-archive' in email.mailboxIds)
      ).toHaveLength(total)
    })
  })

  it('opens the menu of a row on a right click, and on Shift+F10', async () => {
    const server = makeServer()
    await renderList(server)

    fireEvent.contextMenu(row('Email 1'), { clientX: 120, clientY: 80 })
    const menu = await screen.findByRole('menu', { name: 'Message actions' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent)
    ).toEqual([
      'Reply',
      'Reply all',
      'Forward',
      'Move to trash',
      'Archive message',
      'Mark as read',
      'Star',
      'Move message',
      'Mark as spam',
      'Edit as new email'
    ])
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null)
    })

    within(row('Email 2')).getByRole('link').focus()
    await userEvent.keyboard('{Shift>}{F10}{/Shift}')
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Move to trash' })
    )

    await waitFor(() => {
      expect(
        server.emails.find(email => email.id === 'e2')?.mailboxIds
      ).toEqual({ 'mailbox-trash': true })
    })
  })

  it('moves an email to the folder chosen in the picker, filtered by name', async () => {
    const server = makeServer()
    await renderList(server)

    await userEvent.click(
      within(row('Email 0')).getByRole('button', { name: 'Message actions' })
    )
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Move message' })
    )
    const picker = await screen.findByRole('dialog', { name: 'Move To' })
    expect(
      within(picker).getByRole('option', { name: 'Inbox' })
    ).toHaveAttribute('aria-disabled', 'true')
    await userEvent.keyboard('wor{Enter}')

    await waitFor(() => {
      expect(
        server.emails.find(email => email.id === 'e0')?.mailboxIds
      ).toEqual({ work: true })
    })
    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Moved to Work'
    )
  })

  it('deletes forever from the Trash after a confirmation', async () => {
    const server = makeServer(makeEmails(2, 'mailbox-trash'))
    await renderList(server, 'mailbox-trash')

    await userEvent.click(
      within(row('Email 0')).getByRole('button', { name: 'Delete permanently' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Delete message forever'
    })
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    )

    await waitFor(() => {
      expect(server.emails.map(email => email.id)).toEqual(['e1'])
    })
  })

  it('moves the dragged emails to the folder they are dropped on', async () => {
    const server = makeServer()
    await renderList(server)
    await userEvent.click(checkbox('Email 0'))
    await userEvent.click(checkbox('Email 1'))
    const data = new Map<string, string>()
    const dataTransfer = {
      setData: (type: string, value: string): void => {
        data.set(type, value)
      },
      getData: (type: string): string => data.get(type) ?? '',
      get types(): string[] {
        return [...data.keys()]
      },
      setDragImage: jest.fn(),
      effectAllowed: 'none',
      dropEffect: 'none'
    }

    fireEvent.dragStart(row('Email 1'), { dataTransfer })
    expect(dataTransfer.setDragImage).toHaveBeenCalled()
    expect(JSON.parse(data.get(DRAGGED_EMAILS_TYPE) ?? '{}')).toEqual({
      mailboxId: 'mailbox-inbox',
      emailIds: ['e0', 'e1']
    })
    const target = within(folder('Work')).getByRole('link')
    fireEvent.dragEnter(target, { dataTransfer })
    fireEvent.dragOver(target, { dataTransfer })
    fireEvent.drop(target, { dataTransfer })

    await waitFor(() => {
      expect(
        server.emails
          .filter(email => 'work' in email.mailboxIds)
          .map(email => email.id)
      ).toEqual(['e0', 'e1'])
    })
  })

  it('acts on every email of a conversation from its menu and the selection', async () => {
    window.localStorage.setItem('twake-mail.preferences.thread', 'true')
    const server = makeServer([
      makeEmail({
        id: 'first',
        threadId: 'plan',
        subject: 'Plan',
        receivedAt: '2026-01-01T08:00:00Z'
      }),
      makeEmail({
        id: 'mine',
        threadId: 'plan',
        subject: 'Re: Plan',
        mailboxIds: { 'mailbox-sent': true },
        receivedAt: '2026-01-02T08:00:00Z'
      }),
      makeEmail({
        id: 'last',
        threadId: 'plan',
        subject: 'Re: Plan',
        receivedAt: '2026-01-03T08:00:00Z'
      }),
      makeEmail({ id: 'other', subject: 'Lunch' })
    ])
    try {
      await renderList(server)

      fireEvent.contextMenu(row('Re: Plan'), { clientX: 120, clientY: 80 })
      // The answers go to the email standing for the conversation
      expect(
        (await screen.findAllByRole('menuitem'))
          .slice(0, 3)
          .map(item => item.textContent)
      ).toEqual(['Reply', 'Reply all', 'Forward'])
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'Archive message' })
      )

      // tmail-flutter ADR 0068: a thread action reaches all its emails
      await waitFor(() => {
        expect(
          server.emails
            .filter(email => email.threadId === 'plan')
            .map(email => email.mailboxIds)
        ).toEqual([
          { 'mailbox-archive': true },
          { 'mailbox-archive': true },
          { 'mailbox-archive': true }
        ])
      })
      await waitFor(() => {
        expect(screen.getAllByTestId('email-list-item')).toHaveLength(1)
      })

      await userEvent.click(checkbox('Lunch'))
      await userEvent.click(
        screen.getByTestId('selected-email-action-mark-as-read')
      )
      await waitFor(() => {
        expect(
          server.emails.find(email => email.id === 'other')?.keywords
        ).toEqual({ $seen: true })
      })
    } finally {
      window.localStorage.clear()
    }
  })
})
