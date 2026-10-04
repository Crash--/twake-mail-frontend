import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  FAKE_ACCOUNT_ID,
  FAKE_USERNAME,
  makeEmailWithBody,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { ConversationView } from './ConversationView'
import { patchConversation } from './patchConversation'
import { conversationKeys, type ConversationData } from './queries'

const THREAD = 'thread-1'

function makeServer(): FakeJmapServer {
  const email = (
    id: string,
    day: number,
    overrides: Parameters<typeof makeEmailWithBody>[0] = { id }
  ): ReturnType<typeof makeEmailWithBody> =>
    makeEmailWithBody(
      {
        threadId: THREAD,
        subject: 'Project kick-off',
        preview: `Preview ${id}`,
        receivedAt: `2026-10-0${day}T08:00:00Z`,
        keywords: { $seen: true },
        ...overrides,
        id
      },
      { text: `Body of ${id}` }
    )
  return makeFakeJmapServer({
    emails: [
      email('a', 1, {
        id: 'a',
        from: [{ name: 'Bob Dupont', email: 'bob@example.com' }]
      }),
      email('b', 2, {
        id: 'b',
        keywords: {},
        from: [{ name: 'Carol', email: 'carol@example.com' }]
      }),
      email('c', 3, {
        id: 'c',
        subject: 'Re: Project kick-off',
        from: [{ name: 'Dan', email: 'dan@example.com' }]
      }),
      // The copy in Sent of an email the user sent to themselves
      email('own', 4, {
        id: 'own',
        mailboxIds: { 'mailbox-sent': true },
        from: [{ name: null, email: FAKE_USERNAME }],
        to: [{ name: null, email: FAKE_USERNAME }]
      })
    ]
  })
}

async function renderConversation(
  server: FakeJmapServer
): Promise<ReturnType<typeof renderWithProviders>> {
  const result = renderWithProviders(
    <ConversationView threadId={THREAD} emailId="c" onBack={jest.fn()} />,
    { withJmapSession: true, jmapServer: server }
  )
  await screen.findByRole('list', { name: 'Messages of the conversation' })
  return result
}

function toggle(name: RegExp): HTMLElement {
  return screen.getByRole('button', { name })
}

describe('ConversationView', () => {
  it('shows the messages of the thread, unread and last ones expanded', async () => {
    await renderConversation(makeServer())

    expect(
      screen.getByRole('heading', { name: 'Re: Project kick-off' })
    ).toHaveFocus()
    expect(screen.getByText('3 messages')).toBeVisible()
    expect(screen.getAllByTestId('conversation-message')).toHaveLength(3)
    expect(toggle(/Bob Dupont/)).toHaveAttribute('aria-expanded', 'false')
    expect(toggle(/Carol/)).toHaveAttribute('aria-expanded', 'true')
    expect(toggle(/Dan/)).toHaveAttribute('aria-expanded', 'true')
    expect(within(toggle(/Bob Dupont/)).getByText('Preview a')).toBeVisible()
  })

  it('marks the unread message read once expanded', async () => {
    const server = makeServer()
    await renderConversation(server)

    await waitFor(() => {
      expect(server.emails.find(email => email.id === 'b')?.keywords).toEqual({
        $seen: true
      })
    })
  })

  it('expands a collapsed message, its body loaded', async () => {
    await renderConversation(makeServer())

    await userEvent.click(toggle(/Bob Dupont/))

    expect(toggle(/Bob Dupont/)).toHaveAttribute('aria-expanded', 'true')
    expect(
      await screen.findByRole('region', { name: /Bob Dupont/ })
    ).toBeVisible()
  })

  it('stars the whole conversation in one request', async () => {
    const server = makeServer()
    await renderConversation(server)
    const before = server.requests.length

    await userEvent.click(
      screen.getByRole('button', { name: 'Mark as starred' })
    )

    expect(screen.getByRole('button', { name: 'Unstar' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await waitFor(() => {
      const sets = server.requests
        .slice(before)
        .flatMap(request => request.methodCalls)
        .filter(
          ([name, args]) =>
            name === 'Email/set' && JSON.stringify(args).includes('$flagged')
        )
      expect(sets).toHaveLength(1)
      expect(Object.keys(sets[0]?.[1].update ?? {}).sort()).toEqual([
        'a',
        'b',
        'c'
      ])
    })
  })

  it('adds a reply arriving while it is open, collapsed, and announces it', async () => {
    const server = makeServer()
    const { queryClient } = await renderConversation(server)
    // The unread message marked read: nothing in flight
    await waitFor(() => {
      expect(server.emails.find(email => email.id === 'b')?.keywords).toEqual({
        $seen: true
      })
    })

    const reply = makeEmailWithBody(
      {
        id: 'd',
        threadId: THREAD,
        subject: 'Re: Project kick-off',
        preview: 'reply thread detail',
        receivedAt: '2026-10-05T08:00:00Z',
        keywords: { $seen: true },
        from: [{ name: 'Erin', email: 'erin@example.com' }]
      },
      { text: 'reply thread detail' }
    )
    server.addEmail(reply)
    act(() => {
      queryClient.setQueryData<ConversationData>(
        conversationKeys.detail(FAKE_ACCOUNT_ID, THREAD),
        data =>
          data
            ? patchConversation(data, THREAD, {
                changed: [reply],
                destroyed: [],
                newStates: new Map()
              })
            : data
      )
    })

    expect(await screen.findByRole('button', { name: /Erin/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(
      within(toggle(/Erin/)).getByText('reply thread detail')
    ).toBeVisible()
    expect(screen.getByText('4 messages')).toBeVisible()
    expect(screen.getByTestId('conversation-announcement')).toHaveTextContent(
      'New message from Erin'
    )
  })

  it('marks the conversation unread, collapsed, and leaves it unread', async () => {
    const server = makeServer()
    await renderConversation(server)
    await waitFor(() => {
      expect(server.emails.find(email => email.id === 'b')?.keywords).toEqual({
        $seen: true
      })
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'Mark as unread' })
    )

    expect(toggle(/Dan/)).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => {
      expect(
        server.emails
          .filter(email => ['a', 'b', 'c'].includes(email.id))
          .map(email => email.keywords)
      ).toEqual([{}, {}, {}])
    })
    expect(screen.getByRole('button', { name: 'Mark as read' })).toBeVisible()
  })
})
