import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import {
  FAKE_ACCOUNT_ID,
  FAKE_USERNAME,
  makeEmailWithBody,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import {
  FAKE_LINAGORA_CAPABILITIES,
  installFakeLabels
} from '@common/testing/fakeLinagora'
import { renderWithProviders } from '@common/testing/renderWithProviders'
import { ComposerProvider } from '@common/features/composer/ComposerProvider'
import { LabelActionsProvider } from '@common/features/labels/LabelActionsProvider'

import { ConversationView } from './ConversationView'
import { patchConversation } from './patchConversation'
import { conversationKeys, type ConversationData } from './queries'

const THREAD = 'thread-1'

function makeServer(
  capabilities: Record<string, unknown> = {}
): FakeJmapServer {
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
    capabilities,
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
  server: FakeJmapServer,
  { emailId = 'c', fromList = false } = {}
): Promise<ReturnType<typeof renderWithProviders>> {
  const result = renderWithProviders(
    <ConversationView
      threadId={THREAD}
      emailId={emailId}
      fromList={fromList}
      onBack={jest.fn()}
    />,
    { withJmapSession: true, jmapServer: server }
  )
  await screen.findByRole('list', { name: 'Messages of the conversation' })
  return result
}

/** The header of a message, a button expanding or collapsing it */
function toggle(name: RegExp): HTMLElement {
  const found = screen
    .getAllByTestId('conversation-message-toggle')
    .filter(element => name.test(element.textContent))
  const [first, ...others] = found
  if (first === undefined || others.length > 0) {
    throw new Error(`${found.length} toggles match ${name}`)
  }
  return first
}

/** The actions of the whole conversation, beside the back button */
function conversationActions(): HTMLElement {
  return screen.getByRole('toolbar', { name: 'Conversation actions' })
}

/** Opens the "More" menu of the toolbar, with the actions on every message */
async function openConversationMenu(): Promise<HTMLElement> {
  await userEvent.click(
    within(conversationActions()).getByRole('button', { name: 'More' })
  )
  return screen.getByTestId('conversation-menu')
}

/** The actions of an expanded message, named by its sender and date */
function messageActions(name: RegExp): HTMLElement {
  return screen.getByRole('group', {
    name: new RegExp(`^Actions on the message from ${name.source}`)
  })
}

describe('ConversationView', () => {
  it('shows the messages of the thread, unread and last ones expanded', async () => {
    await renderConversation(makeServer())

    expect(screen.getByText('3 messages')).toBeVisible()
    expect(screen.getAllByTestId('conversation-message')).toHaveLength(3)
    expect(toggle(/Bob Dupont/)).toHaveAttribute('aria-expanded', 'false')
    expect(toggle(/Carol/)).toHaveAttribute('aria-expanded', 'true')
    expect(toggle(/Dan/)).toHaveAttribute('aria-expanded', 'true')
    expect(within(toggle(/Bob Dupont/)).getByText('Preview a')).toBeVisible()
  })

  describe('backend warnings', () => {
    function makeWarnedServer(): FakeJmapServer {
      const server = makeServer()
      const message = server.emails.find(email => email.id === 'c')
      if (message === undefined) throw new Error('no message c')
      message.headers = {
        'X-TWP-Message': ['level:error code:virus', 'level:info Plain text']
      }
      return server
    }

    it('shows the banners in the expanded message that has them, with the badge', async () => {
      await renderConversation(makeWarnedServer())

      const banners = await screen.findAllByTestId(/^twp-warning-\d$/)
      expect(banners).toHaveLength(2)
      expect(banners[0]).toHaveTextContent('This email is having virus')
      expect(banners[1]).toHaveTextContent('Plain text')
      expect(
        await screen.findAllByTestId('conversation-message-danger-badge')
      ).toHaveLength(1)
    })

    it('keeps a collapsed message plain, without banner nor badge', async () => {
      await renderConversation(makeServer())

      expect(screen.queryByTestId('twp-warnings')).toBeNull()
      expect(
        screen.queryByTestId('conversation-message-danger-badge')
      ).toBeNull()
    })

    it('dismisses one banner of a message with its keyword', async () => {
      const server = makeWarnedServer()
      await renderConversation(server)

      await userEvent.click(await screen.findByTestId('twp-warning-dismiss-1'))

      await waitFor(() => {
        expect(
          server.emails.find(email => email.id === 'c')?.keywords
        ).toHaveProperty('twp-warning-dismissed-1', true)
      })
      expect(screen.queryByTestId('twp-warning-1')).toBeNull()
      expect(screen.getByTestId('twp-warning-0')).toBeInTheDocument()
    })
  })

  describe('the message it opens on', () => {
    let scrollIntoView: jest.SpyInstance

    beforeEach(() => {
      scrollIntoView = jest.spyOn(Element.prototype, 'scrollIntoView')
      mockViewport({ width: 1400 })
    })

    afterEach(() => {
      scrollIntoView.mockRestore()
      resetViewport()
    })

    it('is the email opened from a search result or a link, focused and scrolled to', async () => {
      await renderConversation(makeServer(), { emailId: 'a' })

      expect(toggle(/Bob Dupont/)).toHaveFocus()
      expect(toggle(/Bob Dupont/)).toHaveAttribute('aria-expanded', 'true')
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: 'start',
        behavior: 'instant'
      })
      expect(scrollIntoView.mock.contexts[0]).toBe(toggle(/Bob Dupont/))
    })

    it('is the first unread message from a list', async () => {
      await renderConversation(makeServer(), { fromList: true })

      expect(toggle(/Carol/)).toHaveFocus()
    })

    it('is the latest message from a list when all are read', async () => {
      const server = makeServer()
      const unread = server.emails.find(email => email.id === 'b')
      if (unread) unread.keywords = { $seen: true }
      await renderConversation(server, { fromList: true })

      expect(toggle(/Dan/)).toHaveFocus()
    })

    it('is described by the subject and count of the conversation, until the focus leaves', async () => {
      const user = userEvent.setup()
      await renderConversation(makeServer())

      const target = toggle(/Dan/)
      expect(target).toHaveAccessibleDescription(
        expect.stringContaining('3 messages')
      )
      expect(target).toHaveAccessibleDescription(
        expect.stringContaining('Re: Project kick-off')
      )
      await user.tab()
      expect(target).not.toHaveAttribute('aria-describedby')
    })

    it('is described by the subject and count only, not the labels of the conversation', async () => {
      const server = makeServer(FAKE_LINAGORA_CAPABILITIES)
      installFakeLabels(server, [
        { id: 'l1', displayName: 'Work', keyword: 'work', color: null }
      ])
      for (const email of server.emails) {
        email.keywords = { ...email.keywords, work: true }
      }
      renderWithProviders(
        <LabelActionsProvider>
          <ConversationView threadId={THREAD} emailId="c" onBack={jest.fn()} />
        </LabelActionsProvider>,
        { withJmapSession: true, jmapServer: server }
      )
      await screen.findByRole('list', { name: 'Messages of the conversation' })

      const description = toggle(/Dan/).getAttribute('aria-describedby') ?? ''
      const text = description
        .split(' ')
        .map(id => document.getElementById(id)?.textContent ?? '')
        .join(' ')
      expect(text).toContain('Re: Project kick-off')
      expect(text).toContain('3 messages')
      expect(text).not.toContain('Work')
    })

    it.each([false, true])(
      'scrolls at once, never smoothly, whatever the motion preference (reduced: %s)',
      async reducedMotion => {
        mockViewport({ width: 1400, reducedMotion })
        await renderConversation(makeServer())

        expect(scrollIntoView).toHaveBeenCalled()
        for (const [options] of scrollIntoView.mock.calls) {
          expect(options).toEqual({ block: 'start', behavior: 'instant' })
        }
      }
    )

    it('does not move the focus nor scroll when a message arrives, expands or collapses', async () => {
      const user = userEvent.setup()
      const server = makeServer()
      const { queryClient } = await renderConversation(server)
      await user.click(toggle(/Dan/))
      await user.click(toggle(/Dan/))
      const calls = scrollIntoView.mock.calls.length

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
      await screen.findByRole('button', { name: /Erin/ })

      expect(scrollIntoView).toHaveBeenCalledTimes(calls)
      expect(toggle(/Dan/)).toHaveFocus()
    })
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

  it('offers Unsubscribe on the message that has a link, and only there', async () => {
    const server = makeServer()
    const message = server.emails.find(email => email.id === 'c')
    if (message) {
      message.headers = { 'List-Unsubscribe': '<https://example.com/u?id=1>' }
    }
    const open = jest.spyOn(window, 'open').mockReturnValue(null)
    await renderConversation(server)

    const links = await screen.findAllByTestId('email-unsubscribe-link')
    expect(links).toHaveLength(1)
    const [link] = links
    if (!link) throw new Error('No Unsubscribe link')
    await userEvent.click(link)
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Unsubscribe'
      })
    )

    expect(open).toHaveBeenCalledWith(
      'https://example.com/u?id=1',
      '_blank',
      'noopener,noreferrer'
    )
    await waitFor(() => {
      expect(server.emails.find(email => email.id === 'c')?.keywords).toEqual({
        $seen: true,
        $unsubscribe: true
      })
    })
    open.mockRestore()
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
      within(await openConversationMenu()).getByRole('menuitem', {
        name: 'Mark as starred'
      })
    )

    expect(
      within(await openConversationMenu()).getByRole('menuitem', {
        name: 'Unstar'
      })
    ).toBeVisible()
    await userEvent.keyboard('{Escape}')
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
      within(await openConversationMenu()).getByRole('menuitem', {
        name: 'Mark as unread'
      })
    )

    expect(toggle(/Dan/)).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => {
      expect(
        server.emails
          .filter(email => ['a', 'b', 'c'].includes(email.id))
          .map(email => email.keywords)
      ).toEqual([{}, {}, {}])
    })
    expect(
      within(await openConversationMenu()).getByRole('menuitem', {
        name: 'Mark as read'
      })
    ).toBeVisible()
  })
})

describe('ConversationView, an expanded message', () => {
  /** The emails of the thread, after the unread one was marked read */
  async function renderRead(server: FakeJmapServer): Promise<void> {
    await renderConversation(server)
    await waitFor(() => {
      expect(server.emails.find(email => email.id === 'b')?.keywords).toEqual({
        $seen: true
      })
    })
  }

  function setsSince(
    server: FakeJmapServer,
    before: number
  ): Record<string, unknown>[] {
    return server.requests
      .slice(before)
      .flatMap(request => request.methodCalls)
      .filter(([name]) => name === 'Email/set')
      .map(([, args]) => args)
  }

  it('has its own actions, outside its header, named by its sender and date', async () => {
    await renderRead(makeServer())

    const actions = messageActions(/Dan/)
    expect(actions).toHaveAccessibleName(/^Actions on the message from Dan, /)
    expect(
      within(actions).getByRole('button', { name: 'Mark as starred' })
    ).toHaveAttribute('aria-pressed', 'false')
    expect(within(actions).getByRole('button', { name: 'More' })).toBeVisible()
    // No control nested in the button toggling the message
    expect(within(toggle(/Dan/)).queryByRole('button')).toBe(null)
  })

  it('stars that message only', async () => {
    const server = makeServer()
    await renderRead(server)
    const before = server.requests.length

    await userEvent.click(
      within(messageActions(/Dan/)).getByRole('button', {
        name: 'Mark as starred'
      })
    )

    await waitFor(() => {
      expect(setsSince(server, before)).toHaveLength(1)
    })
    expect(Object.keys(setsSince(server, before)[0]?.update ?? {})).toEqual([
      'c'
    ])
    expect(
      within(messageActions(/Dan/)).getByRole('button', { name: 'Unstar' })
    ).toHaveAttribute('aria-pressed', 'true')
    // The conversation is not starred: one message only is
    expect(
      within(await openConversationMenu()).getByRole('menuitem', {
        name: 'Mark as starred'
      })
    ).toBeVisible()
  })

  it('collapses once marked unread, its header keeping the focus', async () => {
    const server = makeServer()
    await renderRead(server)

    await userEvent.click(
      within(messageActions(/Dan/)).getByRole('button', { name: 'More' })
    )
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Mark as unread' })
    )

    await waitFor(() => {
      expect(toggle(/Dan/)).toHaveAttribute('aria-expanded', 'false')
    })
    expect(toggle(/Dan/)).toHaveFocus()
    expect(server.emails.find(email => email.id === 'c')?.keywords).toEqual({})
    expect(server.emails.find(email => email.id === 'b')?.keywords).toEqual({
      $seen: true
    })
  })

  it('offers the actions of the folder of the message', async () => {
    const server = makeServer()
    const bob = server.emails.find(email => email.id === 'a')
    if (bob) bob.mailboxIds = { 'mailbox-trash': true }
    await renderRead(server)

    await userEvent.click(toggle(/Bob Dupont/))

    expect(
      within(messageActions(/Bob Dupont/)).getByRole('button', {
        name: 'Delete permanently'
      })
    ).toBeVisible()
    expect(
      within(messageActions(/Dan/)).getByRole('button', {
        name: 'Move to trash'
      })
    ).toBeVisible()
  })

  it('opens the contact card of its sender', async () => {
    const server = makeServer(FAKE_LINAGORA_CAPABILITIES)
    await renderRead(server)

    await userEvent.click(
      within(screen.getByRole('region', { name: /Dan/ })).getByRole('button', {
        name: '<dan@example.com>'
      })
    )

    const card = await screen.findByRole('dialog', { name: /Dan/ })
    expect(
      within(card).getByRole('button', { name: 'Copy the email address' })
    ).toBeVisible()
    expect(
      within(card).getByRole('button', { name: 'Compose email' })
    ).toBeVisible()
    expect(
      within(card).getByRole('button', {
        name: 'Create a rule with this email'
      })
    ).toBeVisible()
  })

  it('shows its own labels, the × taking one off that message only', async () => {
    const server = makeServer(FAKE_LINAGORA_CAPABILITIES)
    installFakeLabels(server, [
      { id: 'l1', displayName: 'Work', keyword: 'work', color: null }
    ])
    for (const email of server.emails) {
      if (email.id === 'b' || email.id === 'c') {
        email.keywords = { ...email.keywords, work: true }
      }
    }
    renderWithProviders(
      <LabelActionsProvider>
        <ConversationView threadId={THREAD} emailId="c" onBack={jest.fn()} />
      </LabelActionsProvider>,
      { withJmapSession: true, jmapServer: server }
    )
    const dan = await screen.findByRole('region', { name: /Dan/ })

    await userEvent.click(
      await within(dan).findByRole('button', {
        name: 'Remove the label Work'
      })
    )

    await waitFor(() => {
      expect(server.emails.find(email => email.id === 'c')?.keywords).toEqual({
        $seen: true
      })
    })
    expect(server.emails.find(email => email.id === 'b')?.keywords).toEqual({
      $seen: true,
      work: true
    })
  })

  it('leaves once none of its messages is left in the folder', async () => {
    const server = makeServer()
    const onBack = jest.fn()
    renderWithProviders(
      <ConversationView
        threadId={THREAD}
        emailId="c"
        mailboxId="mailbox-inbox"
        onBack={onBack}
      />,
      { withJmapSession: true, jmapServer: server }
    )
    await screen.findByRole('list', { name: 'Messages of the conversation' })
    const trash = async (name: RegExp): Promise<void> => {
      if (toggle(name).getAttribute('aria-expanded') === 'false') {
        await userEvent.click(toggle(name))
      }
      await userEvent.click(
        await within(messageActions(name)).findByRole('button', {
          name: 'Move to trash'
        })
      )
    }

    await trash(/Dan/)
    await waitFor(() => {
      expect(server.emails.find(email => email.id === 'c')?.mailboxIds).toEqual(
        { 'mailbox-trash': true }
      )
    })
    // Still in the conversation, with its new folder
    expect(toggle(/Dan/)).toBeVisible()
    expect(onBack).not.toHaveBeenCalled()

    await trash(/Carol/)
    await trash(/Bob Dupont/)
    await waitFor(() => {
      expect(onBack).toHaveBeenCalledTimes(1)
    })
  })

  describe('a draft of the conversation', () => {
    function makeServerWithDraft(): FakeJmapServer {
      const server = makeServer()
      server.addEmail(
        makeEmailWithBody(
          {
            id: 'draft',
            threadId: THREAD,
            subject: 'Re: Project kick-off',
            preview: 'Not sent yet',
            receivedAt: '2026-10-05T08:00:00Z',
            mailboxIds: { 'mailbox-drafts': true },
            keywords: { $seen: true, $draft: true },
            from: [{ name: null, email: FAKE_USERNAME }],
            to: [{ name: 'Bob Dupont', email: 'bob@example.com' }]
          },
          { text: 'Not sent yet' }
        )
      )
      return server
    }

    async function renderWithComposer(server: FakeJmapServer): Promise<void> {
      renderWithProviders(
        <ComposerProvider>
          <ConversationView threadId={THREAD} emailId="c" onBack={jest.fn()} />
        </ComposerProvider>,
        { withJmapSession: true, jmapServer: server }
      )
      await screen.findByRole('list', { name: 'Messages of the conversation' })
    }

    it('is marked as a draft, edited in the composer rather than answered', async () => {
      await renderWithComposer(makeServerWithDraft())

      const draft = toggle(/Draft/)
      expect(
        within(draft).getByTestId('conversation-message-draft')
      ).toHaveTextContent('Draft')
      const actions = await screen.findByRole('group', {
        name: 'Draft actions'
      })
      expect(
        screen.queryByRole('group', { name: /^Actions on the message from Me/ })
      ).toBe(null)

      await userEvent.click(
        within(actions).getByRole('button', {
          name: 'Edit draft to Bob Dupont'
        })
      )

      const composer = await screen.findByRole('dialog', {
        name: 'Re: Project kick-off'
      })
      expect(
        await within(composer).findByRole('textbox', { name: 'Message body' })
      ).toHaveTextContent('Not sent yet')
    })

    it('is deleted forever once confirmed', async () => {
      const server = makeServerWithDraft()
      await renderWithComposer(server)

      const actions = await screen.findByRole('group', {
        name: 'Draft actions'
      })
      await userEvent.click(
        within(actions).getByRole('button', {
          name: 'Delete draft to Bob Dupont'
        })
      )
      await userEvent.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'Delete'
        })
      )

      await waitFor(() => {
        expect(server.emails.some(email => email.id === 'draft')).toBe(false)
      })
    })
  })
})
