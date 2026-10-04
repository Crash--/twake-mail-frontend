import { act, screen, waitFor, within } from '@testing-library/react'
import type { WebSocketLike } from 'jmap-client-ts'

import { MailboxTree } from '@common/features/mailbox/MailboxTree'
import {
  FAKE_ACCOUNT_ID,
  FAKE_WEBSOCKET_URL,
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

async function renderWithPush(server: FakeJmapServer): Promise<{
  socket: FakeWebSocket
  result: ReturnType<typeof renderWithProviders>
}> {
  const result = renderWithProviders(
    <PushProvider WebSocket={FakeWebSocket}>
      <MailboxTree />
    </PushProvider>,
    { withJmapSession: true, jmapServer: server }
  )
  await screen.findAllByTestId('mailbox-item')
  await waitFor(() => {
    expect(FakeWebSocket.instances).toHaveLength(1)
  })
  const [socket] = FakeWebSocket.instances
  if (!socket) throw new Error('No WebSocket opened')
  act(() => {
    socket.open()
  })
  return { socket, result }
}

function mailboxGetCount(server: FakeJmapServer): number {
  return server.calledMethods().filter(name => name === 'Mailbox/get').length
}

describe('PushProvider', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
  })

  it('subscribes to the Email and Mailbox changes', async () => {
    const { socket } = await renderWithPush(
      makeFakeJmapServer({ webSocket: true })
    )

    expect(socket.url).toBe(FAKE_WEBSOCKET_URL)
    expect(socket.protocols).toBe('jmap')
    expect(JSON.parse(socket.sent[0] ?? '{}')).toEqual({
      '@type': 'WebSocketPushEnable',
      dataTypes: ['Email', 'Mailbox']
    })
  })

  it('refetches the mailboxes when the server says they changed', async () => {
    const server = makeFakeJmapServer({ webSocket: true })
    const { socket } = await renderWithPush(server)
    expect(inboxUnreadCount()).toBe('2')

    const inbox = server.mailboxes.find(mailbox => mailbox.role === 'inbox')
    if (inbox) inbox.unreadEmails = 7
    act(() => {
      socket.receive(stateChange(FAKE_ACCOUNT_ID, { Mailbox: 'm2' }))
    })

    await waitFor(() => {
      expect(inboxUnreadCount()).toBe('7')
    })
  })

  it('refetches the email lists and emails on an Email change', async () => {
    const server = makeFakeJmapServer({ webSocket: true })
    const { socket, result } = await renderWithPush(server)
    const invalidate = jest.spyOn(result.queryClient, 'invalidateQueries')

    act(() => {
      socket.receive(stateChange(FAKE_ACCOUNT_ID, { Email: 'e2' }))
    })

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['thread', FAKE_ACCOUNT_ID]
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['email', FAKE_ACCOUNT_ID]
    })
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: ['mailbox', FAKE_ACCOUNT_ID]
    })
  })

  it('ignores the changes of other accounts', async () => {
    const server = makeFakeJmapServer({ webSocket: true })
    const { socket } = await renderWithPush(server)
    await waitFor(() => {
      expect(mailboxGetCount(server)).toBe(2)
    })

    act(() => {
      socket.receive(stateChange('another-account', { Mailbox: 'm2' }))
    })

    expect(mailboxGetCount(server)).toBe(2)
  })

  it('closes the channel when the session screens go away', async () => {
    const { socket, result } = await renderWithPush(
      makeFakeJmapServer({ webSocket: true })
    )

    result.unmount()

    expect(socket.isClosed).toBe(true)
  })
})
