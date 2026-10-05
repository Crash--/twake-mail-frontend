import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Link, Route, Routes } from 'react-router'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import {
  FAKE_ACCOUNT_ID,
  FAKE_USERNAME,
  makeFakeJmapServer,
  makeIdentity,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import type { ComposerSnapshot } from './composerContent'
import {
  ComposerProvider,
  MAX_COMPOSERS,
  useComposer
} from './ComposerProvider'
import {
  clearComposerStorage,
  listComposers,
  putComposer,
  resumeComposerStorage
} from './composerStorage'

function Opener(): ReactElement {
  const { openComposer } = useComposer()
  return (
    <button
      type="button"
      onClick={() => {
        openComposer()
      }}
    >
      Compose
    </button>
  )
}

function renderComposer(
  jmapServer: FakeJmapServer = makeFakeJmapServer()
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <ComposerProvider>
      <Opener />
    </ComposerProvider>,
    { jmapServer, withJmapSession: true }
  )
}

async function openComposer(): Promise<HTMLElement> {
  await userEvent.click(await screen.findByRole('button', { name: 'Compose' }))
  const composer = await screen.findByRole('dialog', { name: 'New message' })
  await within(composer).findByRole('textbox', { name: 'Message body' })
  return composer
}

describe('ComposerProvider', () => {
  afterEach(async () => {
    resetViewport()
    await clearComposerStorage()
  })

  describe('kept in the browser', () => {
    const subjectsKept = async (): Promise<unknown[]> =>
      (await listComposers(FAKE_ACCOUNT_ID)).map(
        stored =>
          (stored.snapshot as { subject?: string } | null)?.subject ?? null
      )

    it('writes the composer while the user types, and nothing on the server', async () => {
      const jmapServer = makeFakeJmapServer()
      renderComposer(jmapServer)
      const composer = await openComposer()

      await userEvent.type(
        within(composer).getByRole('textbox', { name: 'Subject' }),
        'Kept while typing'
      )

      await waitFor(async () => {
        expect(await subjectsKept()).toEqual(['Kept while typing'])
      })
      expect(jmapServer.callsOf('Email/set')).toEqual([])
    })

    it('forgets the composer once closed', async () => {
      renderComposer()
      const composer = await openComposer()
      await userEvent.type(
        within(composer).getByRole('textbox', { name: 'Subject' }),
        'Gone'
      )
      await waitFor(async () => {
        expect(await subjectsKept()).toEqual(['Gone'])
      })

      await userEvent.click(
        within(composer).getByRole('button', { name: 'Save & close' })
      )
      await userEvent.click(
        await screen.findByTestId('confirm-dialog-alternative-button')
      )

      await waitFor(async () => {
        expect(await subjectsKept()).toEqual([])
      })
    })

    it('leaves the composers another tab holds to that tab', async () => {
      resumeComposerStorage()
      for (const id of ['mine', 'theirs']) {
        await putComposer({
          accountId: FAKE_ACCOUNT_ID,
          composerId: id,
          entry: { id, init: {}, mode: 'normal', title: id },
          snapshot: null
        })
      }
      const request = jest.fn(
        (
          name: string,
          _options: unknown,
          callback: (lock: object | null) => unknown
        ) => Promise.resolve(callback(name.endsWith('|theirs') ? null : {}))
      )
      Object.defineProperty(navigator, 'locks', {
        value: { request },
        configurable: true
      })

      try {
        renderComposer()

        expect(
          await screen.findByRole('dialog', { name: 'mine' })
        ).toBeVisible()
        expect(screen.queryByRole('dialog', { name: 'theirs' })).toBe(null)
        // Still there for the tab that holds it
        expect(await subjectsKept()).toHaveLength(2)
      } finally {
        Reflect.deleteProperty(navigator, 'locks')
      }
    })
  })

  it('keeps the same window and editor while the page navigates (issue #93)', async () => {
    renderWithProviders(
      <ComposerProvider>
        <Opener />
        <Routes>
          <Route path="/" element={<Link to="/other">Go</Link>} />
          <Route path="/other" element={<Link to="/">Back</Link>} />
        </Routes>
      </ComposerProvider>,
      { jmapServer: makeFakeJmapServer(), withJmapSession: true }
    )
    const composer = await openComposer()
    const editor = within(composer).getByRole('textbox', {
      name: 'Message body'
    })
    await userEvent.click(editor)
    await userEvent.keyboard('hello')

    await userEvent.click(screen.getByRole('link', { name: 'Go' }))
    await screen.findByRole('link', { name: 'Back' })
    await userEvent.click(screen.getByRole('link', { name: 'Back' }))
    await screen.findByRole('link', { name: 'Go' })

    expect(screen.getByRole('dialog', { name: 'New message' })).toBe(composer)
    const same = within(composer).getByRole('textbox', {
      name: 'Message body'
    })
    expect(same).toBe(editor)
    expect(same).toHaveTextContent('hello')
  })

  it('opens a docked window with the focus in To', async () => {
    renderComposer()
    const composer = await openComposer()

    expect(composer).not.toHaveAttribute('aria-modal')
    expect(within(composer).getByRole('combobox', { name: 'To' })).toHaveFocus()
    expect(
      within(composer).getByRole('button', { name: 'Minimize' })
    ).toBeInTheDocument()
  })

  it('turns typed addresses into recipients and folds them once the subject has the focus', async () => {
    renderComposer()
    const composer = await openComposer()

    await userEvent.keyboard('Bob <bob@example.com>, wrong;')
    const chips = within(composer).getAllByTestId('recipient-chip')
    expect(chips.map(chip => chip.getAttribute('aria-label'))).toEqual([
      'Bob',
      'wrong, invalid address'
    ])

    await userEvent.click(
      within(composer).getByTestId('composer-show-cc-button')
    )
    expect(within(composer).getByRole('combobox', { name: 'Cc' })).toHaveFocus()
    await userEvent.keyboard('carol@example.com')

    await userEvent.click(
      within(composer).getByRole('textbox', { name: 'Subject' })
    )
    const summary = within(composer).getByTestId('composer-recipients-summary')
    expect(summary).toHaveAccessibleName(
      'Show all the recipients: Bob, wrong, carol@example.com'
    )
    expect(within(composer).queryByRole('combobox', { name: 'To' })).toBe(null)

    await userEvent.click(summary)
    expect(within(composer).getByRole('combobox', { name: 'To' })).toHaveFocus()
    expect(within(composer).getByRole('combobox', { name: 'Cc' })).toBeVisible()
  })

  it('suggests the contacts of the server, without the ones already there', async () => {
    renderComposer(
      makeFakeJmapServer({
        capabilities: {
          'com:linagora:params:jmap:contact:autocomplete': {
            minInputLength: 1
          }
        },
        contacts: [
          {
            id: 'c1',
            firstname: 'Zelda',
            surname: 'Contact',
            emailAddress: 'zelda@example.com'
          },
          {
            id: 'c2',
            firstname: 'Zoe',
            surname: 'Other',
            emailAddress: 'zoe@example.com'
          }
        ]
      })
    )
    const composer = await openComposer()
    await userEvent.keyboard('zoe@example.com,z')

    const option = await within(composer).findByRole('option', {
      name: /Zelda Contact/
    })
    expect(within(composer).queryByRole('option', { name: /Zoe/ })).toBe(null)
    await userEvent.click(option)
    expect(
      within(composer)
        .getAllByTestId('recipient-chip')
        .map(chip => chip.getAttribute('title'))
    ).toEqual(['zoe@example.com', 'Zelda Contact <zelda@example.com>'])
  })

  it('names the window after the subject', async () => {
    renderComposer()
    const composer = await openComposer()

    await userEvent.type(
      within(composer).getByRole('textbox', { name: 'Subject' }),
      'Weekly report'
    )
    expect(
      screen.getByRole('dialog', { name: 'Weekly report' })
    ).toBeInTheDocument()
  })

  it('minimizes with Escape and gives the focus back where it was', async () => {
    renderComposer()
    const composer = await openComposer()
    await userEvent.keyboard('alice@example.com')

    await userEvent.keyboard('{Escape}')
    const restore = within(composer).getByRole('button', {
      name: 'Show: New message'
    })
    expect(restore).toHaveFocus()

    await userEvent.click(restore)
    expect(within(composer).getByRole('combobox', { name: 'To' })).toHaveFocus()
  })

  it('closes an untouched message at once, the focus back on what opened it', async () => {
    const { jmapServer } = renderComposer()
    const composer = await openComposer()

    await userEvent.click(
      within(composer).getByRole('button', { name: 'Save & close' })
    )
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Compose' })).toHaveFocus()
    })
    expect(jmapServer.calledMethods()).not.toContain('Email/set')
  })

  it('asks before closing a modified message, and saves it as a draft with its identity', async () => {
    const jmapServer = makeFakeJmapServer({
      identities: [
        makeIdentity({ id: 'identity-alice', mayDelete: false }),
        makeIdentity({
          id: 'identity-work',
          name: 'Alice at work',
          mayDelete: true
        })
      ]
    })
    renderComposer(jmapServer)
    const composer = await openComposer()
    await userEvent.keyboard('bob@example.com,')
    await userEvent.type(
      within(composer).getByRole('textbox', { name: 'Subject' }),
      'Draft subject'
    )

    await userEvent.click(
      within(composer).getByRole('button', { name: 'Save & close' })
    )
    const dialog = await screen.findByRole('dialog', { name: 'Save message' })
    expect(within(dialog).getByRole('button', { name: 'Save' })).toHaveFocus()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByTestId('toast')).toHaveTextContent('Draft saved')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Draft subject' })).toBe(null)
    })
    const draft = jmapServer.emails.find(
      email => email.subject === 'Draft subject'
    )
    expect(draft?.mailboxIds).toEqual({ 'mailbox-drafts': true })
    expect(draft?.keywords).toEqual({ $draft: true, $seen: true })
    expect(draft?.to).toEqual([{ name: null, email: 'bob@example.com' }])
    expect(draft?.from).toEqual([
      { name: 'Alice Martin', email: FAKE_USERNAME }
    ])
    expect(draft?.headers).toMatchObject({
      'X-JMAP-Identity': 'identity-alice'
    })
  })

  it('discards a modified message without saving it', async () => {
    const { jmapServer } = renderComposer()
    const composer = await openComposer()
    await userEvent.keyboard('bob@example.com,')

    await userEvent.click(
      within(composer).getByRole('button', { name: 'Save & close' })
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Discard changes' })
    )
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'New message' })).toBe(null)
    })
    expect(jmapServer.calledMethods()).not.toContain('Email/set')
  })

  it(`opens up to ${MAX_COMPOSERS} composers`, async () => {
    renderComposer()
    for (let count = 0; count < MAX_COMPOSERS; count += 1) {
      await userEvent.click(
        await screen.findByRole('button', { name: 'Compose' })
      )
    }
    await waitFor(() => {
      expect(screen.getAllByTestId('composer')).toHaveLength(MAX_COMPOSERS)
    })

    await userEvent.click(screen.getByRole('button', { name: 'Compose' }))
    expect(await screen.findByTestId('toast')).toHaveTextContent(
      `You can write ${MAX_COMPOSERS} messages at once. Close one to start another.`
    )
    expect(screen.getAllByTestId('composer')).toHaveLength(MAX_COMPOSERS)
  })

  it('fills a phone screen, and Escape closes it', async () => {
    mockViewport({ width: 390, touch: true })
    renderComposer()
    const composer = await openComposer()

    expect(composer).toHaveAttribute('aria-modal', 'true')
    expect(within(composer).queryByRole('button', { name: 'Minimize' })).toBe(
      null
    )
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'New message' })).toBe(null)
    })
  })

  describe('without room for every composer', () => {
    const initialWidth = window.innerWidth

    afterEach(() => {
      window.innerWidth = initialWidth
      void clearComposerStorage()
    })

    /** Composers left by a reload, the oldest first */
    async function restoreComposers(
      subjects: readonly string[]
    ): Promise<void> {
      resumeComposerStorage()
      for (const [index, subject] of subjects.entries()) {
        const snapshot: ComposerSnapshot = {
          identityId: null,
          recipients: { to: [], cc: [], bcc: [], replyTo: [] },
          shown: [],
          subject,
          html: '<p></p>',
          images: [],
          attachments: [],
          draftId: null,
          savedFingerprint: null
        }
        await putComposer({
          accountId: FAKE_ACCOUNT_ID,
          composerId: `composer-${index}`,
          entry: {
            id: `composer-${index}`,
            init: {},
            mode: 'normal',
            title: subject,
            openedAt: index
          },
          snapshot
        })
      }
    }

    it('lists the composers the dock has no room for, and brings one back', async () => {
      window.innerWidth = 1700
      await restoreComposers(['First', 'Second', 'Third'])
      renderComposer()

      expect(await screen.findByRole('dialog', { name: 'Third' })).toBeVisible()
      expect(screen.getByRole('dialog', { name: 'Second' })).toBeVisible()
      expect(screen.queryByRole('dialog', { name: 'First' })).toBe(null)

      await userEvent.click(screen.getByRole('button', { name: '+1 message' }))
      const menu = screen.getByRole('menu', { name: '+1 message' })
      await userEvent.click(
        within(menu).getByRole('menuitem', { name: 'First' })
      )

      const first = await screen.findByRole('dialog', { name: 'First' })
      expect(first).toBeVisible()
      await waitFor(() => {
        expect(first).toContainElement(
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null
        )
      })
      // The oldest of the others makes room
      expect(screen.queryByRole('dialog', { name: 'Second' })).toBe(null)
      expect(screen.getByRole('dialog', { name: 'Third' })).toBeVisible()
    })

    it('reaches the other composers from the one filling a tablet screen', async () => {
      mockViewport({ width: 1000, touch: true })
      window.innerWidth = 1000
      await restoreComposers(['First', 'Second', 'Third'])
      renderComposer()

      const third = await screen.findByRole('dialog', { name: 'Third' })
      expect(third).toHaveAttribute('aria-modal', 'true')
      expect(screen.getAllByRole('dialog')).toHaveLength(1)

      await userEvent.click(
        within(third).getByRole('button', { name: '+2 messages' })
      )
      const menu = screen.getByRole('menu', { name: '+2 messages' })
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map(item => item.textContent)
      ).toEqual(['Second', 'First'])
      await userEvent.keyboard('{ArrowDown}{Enter}')

      const first = await screen.findByRole('dialog', { name: 'First' })
      expect(first).toHaveAttribute('aria-modal', 'true')
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
      expect(
        within(first).getByRole('button', { name: '+2 messages' })
      ).toBeVisible()
    })
  })
})
