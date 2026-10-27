import { VirtuosoMockContext } from '@linagora/twake-mui'
import { useQueryClient } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactElement } from 'react'

import { MailboxTree } from '@common/features/mailbox/MailboxTree'
import { ownStatesOf } from '@common/features/push/ownStates'
import { EmailList } from '@common/features/thread/EmailList'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
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
import type { TargetEmail } from './planEmailChanges'
import {
  inStartFolder,
  useEmailActions,
  type EmailActionName,
  type EmailActionRequest
} from './useEmailActions'

interface ActionButtonProps {
  action: EmailActionName
  emailIds: string[]
  destinationId?: string
  labels?: EmailActionRequest['labels']
}

/** Runs an action on emails of the cache, as the screens will */
function ActionButton({
  action,
  emailIds,
  destinationId,
  labels
}: ActionButtonProps): ReactElement {
  const { run } = useEmailActions()
  const queryClient = useQueryClient()
  const handleClick = (): void => {
    const emails = emailIds.flatMap(id => {
      const email = findCachedEmail(queryClient, FAKE_ACCOUNT_ID, id)
      return email === null ? [] : [email]
    })
    void run({
      action,
      emails,
      mailboxId: 'mailbox-inbox',
      destinationId,
      labels
    })
  }
  return (
    <button type="button" onClick={handleClick}>
      {`Run ${action}`}
    </button>
  )
}

/** Tells whether our own changes lead from `from` to `to` (`ownStates`) */
function OwnStatesProbe({
  from,
  to
}: {
  from: string
  to: () => string
}): ReactElement {
  const client = useJmapClient()
  const [leads, setLeads] = useState<boolean | null>(null)
  const handleClick = (): void => {
    setLeads(ownStatesOf(client, FAKE_ACCOUNT_ID).leadsTo('Email', from, to()))
  }
  return (
    <button type="button" onClick={handleClick}>
      {`Own states lead: ${String(leads)}`}
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
  buttons: ActionButtonProps[],
  probe: ReactElement | null = null
): Promise<void> {
  renderWithProviders(
    <>
      {buttons.map(button => (
        <ActionButton key={button.action} {...button} />
      ))}
      {probe}
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

  it('marks the emails moved to Spam as read', async () => {
    const server = makeServer()
    await renderActions(server, [
      { action: 'moveTo', emailIds: ['e1'], destinationId: 'mailbox-spam' }
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Run moveTo' }))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'Moved to Spam'
    )
    expect(unreadCount('junk')).toBe(null)
    expect(emailSets(server)).toEqual([
      {
        accountId: FAKE_ACCOUNT_ID,
        update: {
          e1: {
            'mailboxIds/mailbox-inbox': null,
            'mailboxIds/mailbox-spam': true,
            'keywords/$seen': true
          }
        }
      }
    ])
  })

  it('keeps the emails moved to another folder unread', async () => {
    const server = makeServer()
    await renderActions(server, [
      { action: 'moveTo', emailIds: ['e1'], destinationId: 'mailbox-archive' }
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Run moveTo' }))

    await screen.findByTestId('toast')
    expect(server.emails.find(email => email.id === 'e1')?.keywords).toEqual({})
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

  it('puts on and takes off several labels in one Email/set per email', async () => {
    const server = makeServer({
      emails: [
        makeEmail({
          id: 'e1',
          receivedAt: '2026-10-03T08:00:00Z',
          keywords: { old: true }
        })
      ]
    })
    await renderActions(server, [
      {
        action: 'setLabels',
        emailIds: ['e1'],
        labels: {
          added: [{ keyword: 'first' }, { keyword: 'second' }],
          removed: [{ keyword: 'old' }]
        }
      }
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Run setLabels' }))

    await screen.findByTestId('toast')
    expect(emailSets(server)).toEqual([
      {
        accountId: FAKE_ACCOUNT_ID,
        update: {
          e1: {
            'keywords/old': null,
            'keywords/first': true,
            'keywords/second': true
          }
        }
      }
    ])
    expect(server.emails.find(email => email.id === 'e1')?.keywords).toEqual({
      first: true,
      second: true
    })
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

  it('remembers its accepted Email/set, for its push to need no Email/changes', async () => {
    const server = makeServer()
    const from = server.states().Email
    await renderActions(
      server,
      [{ action: 'markAsRead', emailIds: ['e1'] }],
      <OwnStatesProbe from={from} to={() => server.states().Email} />
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Run markAsRead' })
    )
    await waitFor(() => {
      expect(emailSets(server)).toHaveLength(1)
    })
    await userEvent.click(
      screen.getByRole('button', { name: /Own states lead/ })
    )

    expect(
      await screen.findByRole('button', { name: 'Own states lead: true' })
    ).not.toBe(null)
  })

  it('does not remember an Email/set the server refused in part', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const server = makeServer()
    server.setErrors.set('e1', 'forbidden')
    const from = server.states().Email
    await renderActions(
      server,
      [{ action: 'markAsRead', emailIds: ['e1'] }],
      <OwnStatesProbe from={from} to={() => server.states().Email} />
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'Run markAsRead' })
    )
    await screen.findByTestId('toast')
    await userEvent.click(
      screen.getByRole('button', { name: /Own states lead/ })
    )

    expect(
      await screen.findByRole('button', { name: 'Own states lead: false' })
    ).not.toBe(null)
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

interface TeamActionButtonProps {
  action: EmailActionName
  mailboxId: string | null
}

const THEIRS: TargetEmail = {
  id: 'theirs',
  mailboxIds: { 'team-inbox': true },
  keywords: {}
}

const MINE: TargetEmail = {
  id: 'mine',
  mailboxIds: { 'mailbox-inbox': true },
  keywords: {}
}

/**
 * Runs an action on a team email, and a personal one out of a folder, as a
 * shortcut does
 */
function TeamActionButton({
  action,
  mailboxId
}: TeamActionButtonProps): ReactElement {
  const { run } = useEmailActions()
  const handleClick = (): void => {
    void run({
      action,
      mailboxId,
      emails: mailboxId === null ? [THEIRS, MINE] : [THEIRS]
    })
  }
  return (
    <button type="button" onClick={handleClick}>
      {`Run ${action}`}
    </button>
  )
}

describe('useEmailActions on team emails', () => {
  function makeTeamServer(): FakeJmapServer {
    return makeFakeJmapServer({
      mailboxes: [
        ...makeDefaultMailboxes(),
        makeMailbox({
          id: 'mailbox-archive',
          name: 'Archive',
          role: 'archive'
        }),
        ...makeTeamMailboxes()
      ],
      emails: [
        makeEmail({ id: 'theirs', mailboxIds: { 'team-inbox': true } }),
        makeEmail({ id: 'mine', mailboxIds: { 'mailbox-inbox': true } })
      ]
    })
  }

  it.each<EmailActionName>(['archive', 'markAsSpam'])(
    'refuses %s in a team mailbox, as its menus, and sends nothing',
    async action => {
      const server = makeTeamServer()
      renderWithProviders(
        <TeamActionButton action={action} mailboxId="team-inbox" />,
        { withJmapSession: true, jmapServer: server }
      )

      await userEvent.click(
        await screen.findByRole('button', { name: `Run ${action}` })
      )

      expect(await screen.findByTestId('toast')).toHaveTextContent(
        'This action is not available in a team mailbox.'
      )
      expect(emailSets(server)).toEqual([])
      expect(
        server.emails.find(email => email.id === 'theirs')?.mailboxIds
      ).toEqual({ 'team-inbox': true })
    }
  )

  it('archives only the personal emails out of a folder', async () => {
    const server = makeTeamServer()
    renderWithProviders(
      <TeamActionButton action="archive" mailboxId={null} />,
      { withJmapSession: true, jmapServer: server }
    )

    await userEvent.click(
      await screen.findByRole('button', { name: 'Run archive' })
    )

    await waitFor(() => {
      expect(
        server.emails.find(email => email.id === 'mine')?.mailboxIds
      ).toEqual({ 'mailbox-archive': true })
    })
    expect(
      server.emails.find(email => email.id === 'theirs')?.mailboxIds
    ).toEqual({ 'team-inbox': true })
  })
})

function StarButton(): ReactElement {
  const { run } = useEmailActions()
  const handleClick = (): void => {
    void run({
      action: 'star',
      mailboxId: 'team-inbox',
      emails: [
        { id: 'theirs', mailboxIds: { 'team-inbox': true }, keywords: {} }
      ]
    })
  }
  return (
    <button type="button" onClick={handleClick}>
      Star
    </button>
  )
}

describe('useEmailActions and the rights of the folder', () => {
  it('refuses with a reason what the rights of the folder forbid, and sends nothing', async () => {
    const server = makeFakeJmapServer({
      mailboxes: [
        ...makeDefaultMailboxes(),
        ...makeTeamMailboxes({ rights: { maySetKeywords: false } })
      ],
      emails: [makeEmail({ id: 'theirs', mailboxIds: { 'team-inbox': true } })]
    })
    renderWithProviders(<StarButton />, {
      withJmapSession: true,
      jmapServer: server
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Star' }))

    expect(await screen.findByTestId('toast')).toHaveTextContent(
      'You do not have the right to do this in this folder.'
    )
    expect(emailSets(server)).toEqual([])
  })
})

describe('inStartFolder', () => {
  const email = (id: string, mailboxId: string): TargetEmail => ({
    id,
    mailboxIds: { [mailboxId]: true },
    keywords: {}
  })

  it('keeps the emails of a conversation in the folder the move starts from', () => {
    const emails = [
      email('received', 'mailbox-inbox'),
      email('sent', 'mailbox-sent'),
      email('draft', 'mailbox-drafts')
    ]

    expect(inStartFolder(emails, 'mailbox-inbox')).toEqual([emails[0]])
  })

  it('keeps them all out of a folder, or when none is in it', () => {
    const emails = [email('sent', 'mailbox-sent')]

    expect(inStartFolder(emails, null)).toEqual(emails)
    expect(inStartFolder(emails, 'mailbox-inbox')).toEqual(emails)
  })
})
