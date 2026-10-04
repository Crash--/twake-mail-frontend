import { VirtuosoMockContext } from '@linagora/twake-mui'
import { act, screen, waitFor, within } from '@testing-library/react'
import type { WebSocketLike } from 'jmap-client-ts'

import { MailboxTree } from '@common/features/mailbox/MailboxTree'
import { EmailList } from '@common/features/thread/EmailList'
import {
  FAKE_ACCOUNT_ID,
  FAKE_WEBSOCKET_URL,
  makeEmail,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

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

/** The mailbox tree and the inbox list, under the push provider */
async function renderWithPush(server: FakeJmapServer): Promise<{
  socket: FakeWebSocket
  result: ReturnType<typeof renderWithProviders>
}> {
  const result = renderWithProviders(
    <PushProvider WebSocket={FakeWebSocket}>
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
  act(() => {
    socket.open()
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

  it('reloads nothing when the channel first opens', async () => {
    const server = makeServer()
    await renderWithPush(server)

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    expect(countCalls(server, 'Mailbox/get')).toBe(1)
    expect(countCalls(server, 'Email/query')).toBe(1)
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

  it('closes the channel when the session screens go away', async () => {
    const { socket, result } = await renderWithPush(makeServer())

    result.unmount()

    expect(socket.isClosed).toBe(true)
  })
})
