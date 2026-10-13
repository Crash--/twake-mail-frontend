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
          `twake-mail-new-mail-alert:page:${FAKE_ACCOUNT_ID}`,
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

    it('asks the server nothing in Space without a team mailbox', async () => {
      const notify = jest.fn()
      const server = makeServer()
      const { socket } = await renderWithPush(server, false, {
        syncHistory: () => () => undefined,
        notifyLoginRequired: jest.fn(),
        reportBadges: jest.fn(),
        notify
      })
      const before = countCalls(server, 'Email/changes')

      server.addEmail(makeEmail({ id: 'pushed' }))
      act(() => {
        socket.receive(stateChange(FAKE_ACCOUNT_ID, server.states()))
      })

      await settled(server, before + 1)
      expect(countCalls(server, 'Email/changes')).toBe(before + 1)
      expect(notify).not.toHaveBeenCalled()
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
    describe('with the service worker of the web push', () => {
      interface WorkerNotification {
        title: string
        tag?: string
        body?: string
        data?: unknown
        close: () => void
      }
      let workerShown: WorkerNotification[] = []
      let listeners: ((event: Event) => void)[] = []

      /** What a page answers on the port of a message of the worker */
      function tell(message: unknown): string[] {
        const answers: string[] = []
        const port = {
          postMessage: (answer: string) => {
            answers.push(answer)
          }
        }
        const event = Object.assign(new Event('message'), {
          data: message,
          ports: [port]
        })
        act(() => {
          listeners.forEach(listener => {
            listener(event)
          })
        })
        return answers
      }

      function servePushSubscriptions(server: FakeJmapServer): void {
        server.handlers.set('PushSubscription/set', args => ({
          created: 'create' in args ? { push: { id: 'ps1' } } : null,
          updated: null,
          destroyed: null,
          notCreated: null,
          notUpdated: null,
          notDestroyed: null
        }))
      }

      beforeEach(() => {
        workerShown = []
        listeners = []
        const registration = {
          showNotification: (title: string, options?: NotificationOptions) => {
            const notification: WorkerNotification = {
              title,
              ...options,
              close: () => {
                workerShown = workerShown.filter(one => one !== notification)
              }
            }
            workerShown.push(notification)
            return Promise.resolve()
          },
          getNotifications: (filter?: { tag?: string }) =>
            Promise.resolve(
              workerShown.filter(
                one => filter?.tag === undefined || one.tag === filter.tag
              )
            ),
          pushManager: {
            getSubscription: () => Promise.resolve(null),
            subscribe: () =>
              Promise.resolve({
                endpoint: 'https://push.example.com/1',
                options: { applicationServerKey: null },
                toJSON: () => ({ keys: { p256dh: 'cDI1Ng', auth: 'YXV0aA' } })
              })
          }
        }
        Object.defineProperty(navigator, 'serviceWorker', {
          configurable: true,
          value: {
            register: () => Promise.resolve(registration),
            ready: Promise.resolve(registration),
            getRegistration: () => Promise.resolve(registration),
            addEventListener: (_type: string, listener: (e: Event) => void) => {
              listeners.push(listener)
            },
            removeEventListener: (
              _type: string,
              listener: (e: Event) => void
            ) => {
              listeners = listeners.filter(one => one !== listener)
            }
          }
        })
        Object.defineProperty(globalThis, 'PushManager', {
          configurable: true,
          value: {}
        })
      })

      afterEach(() => {
        Reflect.deleteProperty(navigator, 'serviceWorker')
        Reflect.deleteProperty(globalThis, 'PushManager')
        window.localStorage.removeItem('twake-mail.push.subscriptions')
      })

      it('reads the new emails on a web push, shows them through the worker, then tells it', async () => {
        const server = makeServer()
        servePushSubscriptions(server)
        await renderWithPush(server, true)
        server.addEmail(makeEmail({ id: 'pushed', subject: 'Pushed news' }))
        workerShown.push({
          title: 'New email',
          tag: 'twake-mail-new-mail',
          close: () => {
            workerShown = workerShown.filter(
              one => one.tag !== 'twake-mail-new-mail'
            )
          }
        })

        const answers = tell({
          type: 'twake-mail-push',
          accountIds: [FAKE_ACCOUNT_ID]
        })

        expect(answers).toEqual(['reading'])
        await waitFor(() => {
          expect(answers).toEqual(['reading', 'shown'])
        })
        // The notification the worker showed alone meanwhile is gone
        expect(
          workerShown.map(({ title, tag, body, data }) => ({
            title,
            tag,
            body,
            data
          }))
        ).toEqual([
          {
            title: 'Bob Dupont',
            tag: 'pushed',
            body: 'Pushed news',
            data: {
              url: '/mailbox/mailbox-inbox/email/pushed',
              accountId: FAKE_ACCOUNT_ID
            }
          }
        ])
        // Not through the page: the worker handles the click
        expect(shown).toEqual([])
      })

      it('tells the worker when the new emails cannot be read', async () => {
        const server = makeServer()
        servePushSubscriptions(server)
        await renderWithPush(server, true)
        server.addEmail(makeEmail({ id: 'pushed' }))
        server.methodErrors.set('Email/changes', 'serverFail')
        jest.spyOn(console, 'warn').mockImplementation(() => undefined)

        const answers = tell({ type: 'twake-mail-push', accountIds: null })

        await waitFor(() => {
          expect(answers).toEqual(['reading', 'failed'])
        })
        expect(workerShown).toEqual([])
      })

      it('leaves the web push of another account to its own tab', async () => {
        const server = makeServer()
        servePushSubscriptions(server)
        await renderWithPush(server, true)
        const before = countCalls(server, 'Email/changes')

        const answers = tell({
          type: 'twake-mail-push',
          accountIds: ['another-account']
        })

        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 0))
        })
        expect(answers).toEqual([])
        expect(countCalls(server, 'Email/changes')).toBe(before)
      })

      it('leaves the web push to the worker when notifications are off', async () => {
        window.localStorage.setItem(
          'twake-mail.preferences.newMailNotifications',
          'false'
        )
        const server = makeServer()
        servePushSubscriptions(server)
        await renderWithPush(server, true)

        expect(tell({ type: 'twake-mail-push', accountIds: null })).toEqual([])
      })

      it('takes the email of a clicked notification of its account only', async () => {
        const server = makeServer()
        servePushSubscriptions(server)
        await renderWithPush(server, true)
        // The test router has no route for an email
        jest.spyOn(console, 'warn').mockImplementation(() => undefined)
        const open = (url: string, accountId: string | null): string[] =>
          tell({ type: 'twake-mail-open', url, accountId })

        expect(open('/mailbox/mailbox-inbox/email/e1', 'another')).toEqual([])
        expect(open('//evil.example.com', FAKE_ACCOUNT_ID)).toEqual([])
        expect(open('https://evil.example.com', null)).toEqual([])
        expect(
          open('/mailbox/mailbox-inbox/email/e1', FAKE_ACCOUNT_ID)
        ).toEqual(['opened'])
      })

      it('takes the click on the notification the worker showed alone', async () => {
        const server = makeServer()
        servePushSubscriptions(server)
        await renderWithPush(server, true)
        jest.spyOn(console, 'warn').mockImplementation(() => undefined)

        expect(
          tell({ type: 'twake-mail-open', url: '/', accountId: null })
        ).toEqual(['opened'])
      })

      it('sends the verification code of its subscription back to the server', async () => {
        const server = makeServer()
        servePushSubscriptions(server)
        await renderWithPush(server, true)
        await waitFor(() => {
          expect(countCalls(server, 'PushSubscription/set')).toBe(1)
        })
        await waitFor(() => {
          expect(
            window.localStorage.getItem('twake-mail.push.subscriptions')
          ).toContain('ps1')
        })

        tell({
          type: 'twake-mail-push-verification',
          pushSubscriptionId: 'ps1',
          verificationCode: 'code'
        })

        await waitFor(() => {
          expect(countCalls(server, 'PushSubscription/set')).toBe(2)
        })
        const call = server.requests
          .flatMap(request => request.methodCalls)
          .filter(([name]) => name === 'PushSubscription/set')
          .at(-1)
        expect(call?.[1]).toEqual({
          update: { ps1: { verificationCode: 'code' } }
        })
      })
    })
  })
})
