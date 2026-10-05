import { VirtuosoMockContext } from '@linagora/twake-mui'
import { useQueryClient } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { MailboxTree } from '@common/features/mailbox/MailboxTree'
import { EmailList } from '@common/features/thread/EmailList'
import { SHARES_CAPABILITY } from '@common/jmap/queries'
import {
  FAKE_ACCOUNT_ID,
  makeDefaultMailboxes,
  makeEmail,
  makeFakeJmapServer,
  makeMailbox,
  makeTeamMailboxes,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'

import { findCachedEmail } from './optimisticEmailChanges'
import { useEmailActions, type EmailActionName } from './useEmailActions'

interface ActionButtonProps {
  action: EmailActionName
  emailIds: string[]
}

/** Runs an action on emails of the cache, as the screens will */
function ActionButton({ action, emailIds }: ActionButtonProps): ReactElement {
  const { run } = useEmailActions()
  const queryClient = useQueryClient()
  const handleClick = (): void => {
    const emails = emailIds.flatMap(id => {
      const email = findCachedEmail(queryClient, FAKE_ACCOUNT_ID, id)
      return email === null ? [] : [email]
    })
    void run({ action, emails, mailboxId: 'mailbox-inbox' })
  }
  return (
    <button type="button" onClick={handleClick}>
      {`Run ${action}`}
    </button>
  )
}

function makeServer(
  options: Parameters<typeof makeFakeJmapServer>[0] = {}
): FakeJmapServer {
  return makeFakeJmapServer({
    mailboxes: [
      ...makeDefaultMailboxes(),
      makeMailbox({ id: 'mailbox-archive', name: 'Archive', role: 'archive' })
    ],
    emails: [
      makeEmail({
        id: 'e1',
        subject: 'First',
        receivedAt: '2026-10-03T08:00:00Z'
      }),
      makeEmail({
        id: 'e2',
        subject: 'Second',
        receivedAt: '2026-10-02T08:00:00Z',
        keywords: { $seen: true }
      })
    ],
    ...options
  })
}

async function renderActions(
  server: FakeJmapServer,
  buttons: ActionButtonProps[]
): Promise<void> {
  renderWithProviders(
    <>
      {buttons.map(button => (
        <ActionButton key={button.action} {...button} />
      ))}
      <MailboxTree />
      <VirtuosoMockContext.Provider
        value={{ viewportHeight: 100_000, itemHeight: 56 }}
      >
        <EmailList mailboxId="mailbox-inbox" />
      </VirtuosoMockContext.Provider>
    </>,
    {
      route: '/mailbox/mailbox-inbox',
      path: '/mailbox/:mailboxId',
      withJmapSession: true,
      jmapServer: server
    }
  )
  await screen.findAllByTestId('email-list-item')
  await screen.findAllByTestId('mailbox-item')
}

function listedIds(): string[] {
  return screen
    .queryAllByTestId('email-list-item')
    .map(row => row.getAttribute('data-email-id') ?? '')
}

function emailSets(server: FakeJmapServer): Record<string, unknown>[] {
  return server.requests.flatMap(({ methodCalls }) =>
    methodCalls.filter(([name]) => name === 'Email/set').map(([, args]) => args)
  )
}

function unreadCount(role: string): string | null {
  const folder = screen
    .getAllByTestId('mailbox-item')
    .find(item => item.getAttribute('data-mailbox-role') === role)
  if (!folder) throw new Error(`No ${role} folder`)
  return (
    within(folder).queryByTestId('mailbox-unread-count')?.textContent ?? null
  )
}

describe('useEmailActions', () => {
  listEmailsOneByOne()

  it('archives an email at once, then offers to undo', async () => {
    const server = makeServer()
    const release = server.holdRequests('Email/set')
    await renderActions(server, [{ action: 'archive', emailIds: ['e1'] }])

    await userEvent.click(screen.getByRole('button', { name: 'Run archive' }))

    // Shown before the server answers
    expect(listedIds()).toEqual(['e2'])
    expect(unreadCount('inbox')).toBe('1')
    release()
    const toast = await screen.findByTestId('toast')
    expect(toast).toHaveTextContent('Moved to Archive')
    expect(emailSets(server)).toEqual([
      {
        accountId: FAKE_ACCOUNT_ID,
        update: {
          e1: {
            'mailboxIds/mailbox-inbox': null,
            'mailboxIds/mailbox-archive': true
          }
        }
      }
    ])
    expect(server.emails.find(email => email.id === 'e1')?.mailboxIds).toEqual({
      'mailbox-archive': true
    })

    await userEvent.click(within(toast).getByRole('button', { name: 'Undo' }))

    await waitFor(() => {
      expect(listedIds()).toEqual(['e1', 'e2'])
    })
    await waitFor(() => {
      expect(
        server.emails.find(email => email.id === 'e1')?.mailboxIds
      ).toEqual({ 'mailbox-inbox': true })
    })
  })

  it('sends a selection in batches of the server limit', async () => {
    const emails = Array.from({ length: 5 }, (_, index) =>
      makeEmail({
        id: `m${index}`,
        receivedAt: `2026-10-0${index + 1}T08:00:00Z`
      })
    )
    const server = makeServer({ emails, maxObjectsInSet: 2 })
    await renderActions(server, [
      { action: 'markAsRead', emailIds: emails.map(email => email.id) }
    ])

    await userEvent.click(
      screen.getByRole('button', { name: 'Run markAsRead' })
    )

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You’ve marked messages as "Read"'
    )
    expect(
      emailSets(server).map(args => Object.keys(args.update ?? {}).length)
    ).toEqual([2, 2, 1])
  })

  it('rolls back the emails the server refuses, and retries them', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const server = makeServer()
    server.setErrors.set('e1', 'forbidden')
    await renderActions(server, [
      { action: 'moveToTrash', emailIds: ['e1', 'e2'] }
    ])

    await userEvent.click(
      screen.getByRole('button', { name: 'Run moveToTrash' })
    )

    const toast = await screen.findByTestId('toast')
    expect(toast).toHaveAttribute('data-severity', 'error')
    expect(toast).toHaveTextContent('Unknown error occurred')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unknown error occurred'
    )
    expect(listedIds()).toEqual(['e1'])

    server.setErrors.clear()
    await userEvent.click(within(toast).getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(listedIds()).toEqual([])
    })
    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Moved to Trash'
    )
    jest.restoreAllMocks()
  })

  it('tells about a connection error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const server = makeServer()
    const { fetch } = server
    server.fetch = async (input, init) => {
      if (typeof init?.body === 'string' && init.body.includes('Email/set')) {
        throw new TypeError('Failed to fetch')
      }
      return fetch(input, init)
    }
    await renderActions(server, [{ action: 'star', emailIds: ['e1'] }])

    await userEvent.click(screen.getByRole('button', { name: 'Run star' }))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Connection error'
    )
    jest.restoreAllMocks()
  })

  it('deletes forever without an undo', async () => {
    const server = makeServer()
    await renderActions(server, [
      { action: 'deletePermanently', emailIds: ['e1', 'e2'] }
    ])

    await userEvent.click(
      screen.getByRole('button', { name: 'Run deletePermanently' })
    )

    const toast = await screen.findByTestId('toast')
    expect(toast).toHaveTextContent('2 messages have been deleted forever')
    expect(within(toast).queryByRole('button', { name: 'Undo' })).toBe(null)
    expect(emailSets(server)).toEqual([
      { accountId: FAKE_ACCOUNT_ID, destroy: ['e1', 'e2'] }
    ])
    expect(server.emails).toEqual([])
  })

  it('sends the team mailbox capability when the session has it', async () => {
    const server = makeServer({ capabilities: { [SHARES_CAPABILITY]: {} } })
    await renderActions(server, [{ action: 'star', emailIds: ['e1'] }])

    await userEvent.click(screen.getByRole('button', { name: 'Run star' }))

    await screen.findByTestId('toast')
    const request = server.requests.find(({ methodCalls }) =>
      methodCalls.some(([name]) => name === 'Email/set')
    )
    expect(request?.using).toContain(SHARES_CAPABILITY)
  })
})

/** Deletes emails shown out of a folder, as a search or Starred does */
function DeleteFromSearch(): ReactElement {
  const { run } = useEmailActions()
  const handleClick = (): void => {
    void run({
      action: 'moveToTrash',
      mailboxId: null,
      emails: [
        { id: 'mine', mailboxIds: { 'mailbox-inbox': true }, keywords: {} },
        { id: 'theirs', mailboxIds: { 'team-inbox': true }, keywords: {} }
      ]
    })
  }
  return (
    <button type="button" onClick={handleClick}>
      Delete from search
    </button>
  )
}

describe('useEmailActions out of a folder', () => {
  it('sends each email to the Trash of its own mailbox, a team email to its team Trash', async () => {
    const server = makeFakeJmapServer({
      mailboxes: [...makeDefaultMailboxes(), ...makeTeamMailboxes()],
      emails: [
        makeEmail({ id: 'mine', mailboxIds: { 'mailbox-inbox': true } }),
        makeEmail({ id: 'theirs', mailboxIds: { 'team-inbox': true } })
      ]
    })
    renderWithProviders(<DeleteFromSearch />, {
      withJmapSession: true,
      jmapServer: server
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete from search' })
    )

    await waitFor(() => {
      expect(emailSets(server)).not.toEqual([])
    })
    await waitFor(() => {
      expect(server.emails.map(email => email.mailboxIds)).toEqual([
        { 'mailbox-trash': true },
        { 'team-trash': true }
      ])
    })
  })
})
