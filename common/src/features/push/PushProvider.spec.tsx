import { VirtuosoMockContext } from '@linagora/twake-mui'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { WebSocketLike } from 'jmap-client-ts'
import { useState, type ReactElement } from 'react'

import { MailboxTree } from '@common/features/mailbox/MailboxTree'
import { EmailList } from '@common/features/thread/EmailList'
import {
  FAKE_ACCOUNT_ID,
  FAKE_WEBSOCKET_URL,
  makeEmail,
  makeDefaultMailboxes,
  makeFakeJmapServer,
  makeTeamMailboxes,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'
import type { SpaceBridge } from '@common/features/teamMailboxEmbed/spaceBridge'

import { PushProvider } from './PushProvider'

class FakeWebSocket implements WebSocketLike {
  static instances: FakeWebSocket[] = []

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  readonly sent: string[] = []
  isClosed = false

  constructor(
    readonly url: string,
    readonly protocols?: string | string[]
  ) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.isClosed = true
  }

  open(): void {
    this.onopen?.(new Event('open'))
  }

  /** The connection drops */
  drop(): void {
    this.onclose?.(new CloseEvent('close', { code: 1006 }))
  }

  receive(message: unknown): void {
    this.onmessage?.(
      new MessageEvent('message', { data: JSON.stringify(message) })
    )
  }
}

function stateChange(
  accountId: string,
  types: Record<string, string>
): unknown {
  return { '@type': 'StateChange', changed: { [accountId]: types } }
}

function inboxUnreadCount(): string | null {
  const inbox = screen
    .getAllByTestId('mailbox-item')
    .find(item => item.getAttribute('data-mailbox-role') === 'inbox')
  if (!inbox) throw new Error('No inbox in the tree')
  return (
    within(inbox).queryByTestId('mailbox-unread-count')?.textContent ?? null
  )
}

function lastSocket(): FakeWebSocket {
  const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
  if (!socket) throw new Error('No WebSocket opened')
  return socket
}

/** The inbox list, behind a button that hides and shows it again */
function TogglableList(): ReactElement {
  const [isShown, setIsShown] = useState(true)
  const handleToggle = (): void => {
    setIsShown(shown => !shown)
  }
  return (
    <>
      <button type="button" onClick={handleToggle}>
        Toggle the list
      </button>
      {isShown ? (
        <VirtuosoMockContext.Provider
          value={{ viewportHeight: 100_000, itemHeight: 56 }}
        >
          <EmailList mailboxId="mailbox-inbox" />
        </VirtuosoMockContext.Provider>
      ) : null}
    </>
  )
}

/** Shows the list again after `delay` ms: refetched only when stale */
async function showListAgainAfter(delay: number): Promise<void> {
  const toggle = screen.getByRole('button', { name: 'Toggle the list' })
  await userEvent.click(toggle)
  const now = Date.now()
  jest.spyOn(Date, 'now').mockReturnValue(now + delay)
  await userEvent.click(toggle)
  await screen.findByTestId('email-list-item')
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 50))
  })
}

/** The mailbox tree and the inbox list, under the push provider */
async function renderWithPush(
  server: FakeJmapServer,
  alertsNewEmails = false,
  spaceBridge: SpaceBridge | null = null
): Promise<{
  socket: FakeWebSocket
  result: ReturnType<typeof renderWithProviders>
}> {
  const result = renderWithProviders(
    <PushProvider
      WebSocket={FakeWebSocket}
      alertsNewEmails={alertsNewEmails}
      spaceBridge={spaceBridge}
    >
      <MailboxTree />
      <VirtuosoMockContext.Provider
        value={{ viewportHeight: 100_000, itemHeight: 56 }}
      >
        <EmailList mailboxId="mailbox-inbox" />
      </VirtuosoMockContext.Provider>
    </PushProvider>,
    {
      route: '/mailbox/mailbox-inbox',
      path: '/mailbox/:mailboxId',
      withJmapSession: true,
      jmapServer: server
    }
  )
  await screen.findAllByTestId('mailbox-item')
  await screen.findByTestId('email-list-item')
  await waitFor(() => {
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
  const socket = lastSocket()
  const getsBefore = countCalls(server, 'Email/get')
  act(() => {
    socket.open()
  })
  // The current states, read once the channel opened, are up to date
  await waitFor(() => {
    expect(countCalls(server, 'Email/get')).toBe(getsBefore + 1)
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return { socket, result }
}

function countCalls(server: FakeJmapServer, method: string): number {
  return server.calledMethods().filter(name => name === method).length
}

function makeServer(): FakeJmapServer {
  return makeFakeJmapServer({
    webSocket: true,
    emails: [makeEmail({ id: 'e1', subject: 'Already there' })]
  })
}

describe('PushProvider', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
  })

  it('subscribes to the Email and Mailbox changes', async () => {
    const { socket } = await renderWithPush(makeServer())

    expect(socket.url).toBe(FAKE_WEBSOCKET_URL)
    expect(socket.protocols).toBe('jmap')
    expect(JSON.parse(socket.sent[0] ?? '{}')).toEqual({
      '@type': 'WebSocketPushEnable',
      dataTypes: ['Email', 'Mailbox']
    })
  })

  it('only reads the current states when the channel first opens', async () => {
    const server = makeServer()
    await renderWithPush(server)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // The list and the tree loaded once, then one request of the states
    expect(countCalls(server, 'Mailbox/get')).toBe(2)
    expect(countCalls(server, 'Email/query')).toBe(1)
    expect(countCalls(server, 'Email/changes')).toBe(0)
  })

  it('catches up an email delivered before the channel first opened', async () => {
    const server = makeServer()
    renderWithProviders(
      <PushProvider WebSocket={FakeWebSocket}>
        <VirtuosoMockContext.Provider
          value={{ viewportHeight: 100_000, itemHeight: 56 }}
        >
          <EmailList mailboxId="mailbox-inbox" />
        </VirtuosoMockContext.Provider>
      </PushProvider>,
      {
        route: '/mailbox/mailbox-inbox',
        path: '/mailbox/:mailboxId',
        withJmapSession: true,
        jmapServer: server
      }
    )
    await screen.findByText('Already there')

    // Delivered after the list loaded, before the channel opened: no push
    server.addEmail(
      makeEmail({
        id: 'early',
        subject: 'Before the socket',
        receivedAt: '2026-10-05T08:00:00Z'
      })
    )
    act(() => {
      lastSocket().open()
    })

    expect(await screen.findByText('Before the socket')).toBeVisible()
    expect(countCalls(server, 'Email/query')).toBe(1)
  })

  it('catches up what arrived offline when the browser is back, without a refetch', async () => {
    const server = makeServer()
    const { socket } = await renderWithPush(server)
    const queriesBefore = countCalls(server, 'Email/query')
    const requestsBefore = server.requests.length

    // Offline for longer than the data stays fresh
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    server.addEmail(
      makeEmail({
        id: 'offline-mail',
        subject: 'Delivered offline',
        receivedAt: '2026-10-05T08:00:00Z'
      })
    )
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60_000)
    // The channel dropped with the network, and is not back yet
    act(() => {
      socket.drop()
      window.dispatchEvent(new Event('online'))
    })

    expect(await screen.findByText('Delivered offline')).toBeVisible()
    expect(countCalls(server, 'Email/changes')).toBeGreaterThan(0)
    expect(countCalls(server, 'Email/query')).toBe(queriesBefore)
    // The mailboxes changed are read by id: none of the whole list again
    const wholeListReads = server.requests
      .slice(requestsBefore)
      .flatMap(request => request.methodCalls)
      .filter(
        ([name, args]) =>
          name === 'Mailbox/get' && (args as { ids?: unknown }).ids === null
      )
    expect(wholeListReads).toHaveLength(0)
  })

  it('updates the counters from the mailbox changes', async () => {
    const server = makeServer()
    const { socket } = await renderWithPush(server)
    expect(inboxUnreadCount()).toBe('2')

    server.updateMailbox('mailbox-inbox', { unreadEmails: 7 })
    act(() => {
      socket.receive(stateChange(FAKE_ACCOUNT_ID, server.states()))
    })

    await waitFor(() => {
      expect(inboxUnreadCount()).toBe('7')
    })
    expect(countCalls(server, 'Mailbox/changes')).toBe(1)
  })

  it('shows a pushed email without reloading the list', async () => {
    const server = makeServer()
    const { socket } = await renderWithPush(server)

    server.addEmail(
      makeEmail({
        id: 'pushed',
        subject: 'Pushed news',
        receivedAt: '2026-10-05T08:00:00Z'
      })
    )
    act(() => {
      socket.receive(stateChange(FAKE_ACCOUNT_ID, server.states()))
    })

    expect(await screen.findByText('Pushed news')).toBeVisible()
    expect(countCalls(server, 'Email/query')).toBe(1)
    expect(countCalls(server, 'Email/changes')).toBe(1)
  })

  it('catches up the changes made while the channel was down', async () => {
    const server = makeServer()
    const { socket } = await renderWithPush(server)

    act(() => {
      socket.drop()
    })
    server.addEmail(
      makeEmail({
        id: 'missed',
        subject: 'Sent while offline',
        receivedAt: '2026-10-05T08:00:00Z'
      })
    )
    await waitFor(
      () => {
        expect(FakeWebSocket.instances).toHaveLength(2)
      },
      { timeout: 3000 }
    )
    act(() => {
      lastSocket().open()
    })

    expect(await screen.findByText('Sent while offline')).toBeVisible()
    expect(countCalls(server, 'Email/query')).toBe(1)
  })

  it('ignores the changes of other accounts', async () => {
    const server = makeServer()
    const { socket } = await renderWithPush(server)

    server.updateMailbox('mailbox-inbox', { unreadEmails: 7 })
    act(() => {
      socket.receive(stateChange('another-account', server.states()))
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    expect(countCalls(server, 'Mailbox/changes')).toBe(0)
    expect(inboxUnreadCount()).toBe('2')
  })

  describe('a list shown again a minute later', () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    async function renderTogglableList(server: FakeJmapServer): Promise<void> {
      renderWithProviders(
        <PushProvider WebSocket={FakeWebSocket}>
          <TogglableList />
        </PushProvider>,
        {
          route: '/mailbox/mailbox-inbox',
          path: '/mailbox/:mailboxId',
          withJmapSession: true,
          jmapServer: server
        }
      )
      await screen.findByTestId('email-list-item')
      await waitFor(() => {
        expect(FakeWebSocket.instances).toHaveLength(1)
      })
    }

    it('is not reloaded while the channel is open', async () => {
      const server = makeServer()
      await renderTogglableList(server)
      act(() => {
        lastSocket().open()
      })

      await showListAgainAfter(60_000)

      expect(countCalls(server, 'Email/query')).toBe(1)
    })

    it('is reloaded once the channel dropped', async () => {
      const server = makeServer()
      await renderTogglableList(server)
      act(() => {
        lastSocket().open()
      })
      act(() => {
        lastSocket().drop()
      })

      await showListAgainAfter(60_000)

      await waitFor(() => {
        expect(countCalls(server, 'Email/query')).toBe(2)
      })
    })
  })

  it('closes the channel when the session screens go away', async () => {
    const { socket, result } = await renderWithPush(makeServer())

    result.unmount()

    expect(socket.isClosed).toBe(true)
  })

  describe('new email alerts', () => {
    let shown: { title: string; body?: string; tag?: string }[] = []

    beforeEach(() => {
      shown = []
      class FakeNotification {
        static permission: NotificationPermission = 'granted'
        onclick: (() => void) | null = null
        constructor(title: string, options?: NotificationOptions) {
          shown.push({ title, ...options })
        }
        close(): void {
          this.onclick = null
        }
      }
      Object.defineProperty(window, 'Notification', {
        value: FakeNotification,
        configurable: true
      })
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true
      })
      window.localStorage.setItem(
        'twake-mail.preferences.newMailNotifications',
        'true'
      )
    })

    afterEach(() => {
      Reflect.deleteProperty(window, 'Notification')
      Reflect.deleteProperty(document, 'visibilityState')
      window.localStorage.removeItem(
        'twake-mail.preferences.newMailNotifications'
      )
    })

    /** Lets the watcher read the changes of the last push */
    async function settled(
      server: FakeJmapServer,
      changes: number
    ): Promise<void> {
      await waitFor(() => {
        expect(countCalls(server, 'Email/changes')).toBeGreaterThanOrEqual(
          changes
        )
      })
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
    }

    it('notifies an email reaching the Inbox, from its sender', async () => {
      const server = makeServer()
      const { socket } = await renderWithPush(server, true)

      server.addEmail(makeEmail({ id: 'pushed', subject: 'Pushed news' }))
      act(() => {
        socket.receive(stateChange(FAKE_ACCOUNT_ID, server.states()))
      })

      await waitFor(() => {
        expect(shown).toEqual([
          { title: 'Bob Dupont', body: 'Pushed news', tag: 'pushed' }
        ])
      })
    })

    it('notifies neither a changed email nor one already read', async () => {
      const server = makeServer()
      const { socket } = await renderWithPush(server, true)
      const before = countCalls(server, 'Email/changes')

      server.updateEmail('e1', { keywords: { $flagged: true } })
      server.addEmail(makeEmail({ id: 'read', keywords: { $seen: true } }))
      act(() => {
        socket.receive(stateChange(FAKE_ACCOUNT_ID, server.states()))
      })

      await settled(server, before + 2)
      expect(shown).toEqual([])
    })

    it('notifies nothing that arrived while the channel was down', async () => {
      const server = makeServer()
      const { socket } = await renderWithPush(server, true)

      act(() => {
        socket.drop()
      })
      server.addEmail(makeEmail({ id: 'missed' }))
      await waitFor(
        () => {
          expect(FakeWebSocket.instances).toHaveLength(2)
        },
        { timeout: 3000 }
      )
      const gets = countCalls(server, 'Email/get')
      act(() => {
        lastSocket().open()
      })
      // The current states, read again once the channel reopened
      await waitFor(() => {
        expect(countCalls(server, 'Email/get')).toBeGreaterThan(gets)
      })
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })
      server.addEmail(makeEmail({ id: 'after', subject: 'After' }))
      act(() => {
        lastSocket().receive(stateChange(FAKE_ACCOUNT_ID, server.states()))
      })

      await waitFor(() => {
        expect(shown.map(({ tag }) => tag)).toEqual(['after'])
      })
    })

    it('notifies nothing while the page is in front', async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true
      })
      jest.spyOn(document, 'hasFocus').mockReturnValue(true)
      const server = makeServer()
      const { socket } = await renderWithPush(server, true)
      const before = countCalls(server, 'Email/changes')

      server.addEmail(makeEmail({ id: 'pushed' }))
      act(() => {
        socket.receive(stateChange(FAKE_ACCOUNT_ID, server.states()))
      })

      await settled(server, before + 2)
      expect(shown).toEqual([])
    })

    it('takes the lock of the alerts only on a page that alerts', async () => {
      const request = jest.fn(() => Promise.resolve())
      Object.defineProperty(navigator, 'locks', {
        value: { request },
        configurable: true
      })
      try {
        const facade = await renderWithPush(makeServer())
        expect(request).not.toHaveBeenCalled()
        facade.result.unmount()
        FakeWebSocket.instances = []

        await renderWithPush(makeServer(), true)
        expect(request).toHaveBeenCalledWith(
          `twake-mail-new-mail-alert:${FAKE_ACCOUNT_ID}`,
          expect.anything(),
          expect.any(Function)
        )
      } finally {
        Reflect.deleteProperty(navigator, 'locks')
      }
    })

    it('asks the server nothing more while both switches are off', async () => {
      window.localStorage.removeItem(
        'twake-mail.preferences.newMailNotifications'
      )
      const server = makeServer()
      const { socket } = await renderWithPush(server, true)
      const before = countCalls(server, 'Email/changes')

      server.addEmail(makeEmail({ id: 'pushed' }))
      act(() => {
        socket.receive(stateChange(FAKE_ACCOUNT_ID, server.states()))
      })

      await settled(server, before + 1)
      // The synchronization of the lists only
      expect(countCalls(server, 'Email/changes')).toBe(before + 1)
      expect(shown).toEqual([])
    })

    it('asks Twake Space to notify the new emails of a team mailbox', async () => {
      const notify = jest.fn()
      const bridge: SpaceBridge = {
        syncHistory: () => () => undefined,
        notifyLoginRequired: jest.fn(),
        reportBadges: jest.fn(),
        notify
      }
      const server = makeFakeJmapServer({
        webSocket: true,
        mailboxes: [...makeDefaultMailboxes(), ...makeTeamMailboxes()],
        emails: [makeEmail({ id: 'e1' })]
      })
      const { socket } = await renderWithPush(server, false, bridge)

      server.addEmail(
        makeEmail({
          id: 'team-news',
          subject: 'For the team',
          mailboxIds: { 'team-inbox': true }
        })
      )
      server.addEmail(makeEmail({ id: 'personal' }))
      act(() => {
        socket.receive(stateChange(FAKE_ACCOUNT_ID, server.states()))
      })

      await waitFor(() => {
        expect(notify).toHaveBeenCalledTimes(1)
      })
      expect(notify).toHaveBeenCalledWith({
        tag: 'mail:team-news',
        title: 'Bob Dupont',
        body: 'For the team',
        resourceId: 'team'
      })
      expect(shown).toEqual([])
    })

    it('notifies nothing unless the page asks for it', async () => {
      const server = makeServer()
      const { socket } = await renderWithPush(server)
      const before = countCalls(server, 'Email/changes')

      server.addEmail(makeEmail({ id: 'pushed' }))
      act(() => {
        socket.receive(stateChange(FAKE_ACCOUNT_ID, server.states()))
      })

      await settled(server, before + 1)
      expect(shown).toEqual([])
    })
  })
})
