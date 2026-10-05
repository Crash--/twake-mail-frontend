import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import {
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { clearComposerStorage, resumeComposerStorage } from './composerStorage'
import { ComposerProvider, useComposer } from './ComposerProvider'
import { DRAFT_IDLE_MS } from './draftPolicy'

/** Benoit's rule (issue #134), written out so that a change of the constant fails here */
const FIVE_MINUTES = 5 * 60 * 1000

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

function draftsOf(server: FakeJmapServer): typeof server.emails {
  return server.emails.filter(email => 'mailbox-drafts' in email.mailboxIds)
}

/** Lets the clock run by `ms`, the requests of the app answered meanwhile */
async function pass(ms: number): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

describe('the save policy of a draft', () => {
  it('waits five minutes of inactivity', () => {
    expect(DRAFT_IDLE_MS).toBe(FIVE_MINUTES)
  })

  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true })
    resumeComposerStorage()
  })

  afterEach(async () => {
    jest.useRealTimers()
    await clearComposerStorage()
  })

  async function openAndType(
    jmapServer: FakeJmapServer
  ): Promise<{ composer: HTMLElement; subject: HTMLElement }> {
    renderWithProviders(
      <ComposerProvider>
        <Opener />
      </ComposerProvider>,
      { jmapServer, withJmapSession: true }
    )
    await user.click(await screen.findByRole('button', { name: 'Compose' }))
    const composer = await screen.findByRole('dialog', { name: 'New message' })
    await within(composer).findByRole('textbox', { name: 'Message body' })
    const subject = within(composer).getByRole('textbox', { name: 'Subject' })
    return { composer, subject }
  }

  it('writes nothing on the server while the user types, then once after the idle delay', async () => {
    const jmapServer = makeFakeJmapServer()
    const { subject } = await openAndType(jmapServer)
    const writes = (): number => jmapServer.callsOf('Email/set').length

    await user.type(subject, 'Hello')
    await pass(FIVE_MINUTES - 1000)
    expect(writes()).toBe(0)

    await pass(1500)
    await waitFor(() => {
      expect(draftsOf(jmapServer).map(email => email.subject)).toEqual([
        'Hello'
      ])
    })
    // One creation; nothing to destroy for a first version
    expect(writes()).toBe(1)
  })

  it('waits for the user to stop: each change starts the delay again', async () => {
    const jmapServer = makeFakeJmapServer()
    const { subject } = await openAndType(jmapServer)

    await user.type(subject, 'One')
    await pass(FIVE_MINUTES - 1000)
    await user.type(subject, ' two')
    await pass(FIVE_MINUTES - 1000)
    expect(jmapServer.callsOf('Email/set')).toHaveLength(0)

    await pass(2000)
    await waitFor(() => {
      expect(draftsOf(jmapServer).map(email => email.subject)).toEqual([
        'One two'
      ])
    })
  })

  it('writes nothing more while the message is the saved one', async () => {
    const jmapServer = makeFakeJmapServer()
    const { subject } = await openAndType(jmapServer)

    await user.type(subject, 'Same')
    await pass(FIVE_MINUTES + 1000)
    await waitFor(() => {
      expect(draftsOf(jmapServer)).toHaveLength(1)
    })
    const calls = jmapServer.callsOf('Email/set').length

    // Typed and erased: the message is what the server has
    await user.type(subject, 'x')
    await user.type(subject, '{Backspace}')
    await pass(3 * FIVE_MINUTES)
    expect(jmapServer.callsOf('Email/set')).toHaveLength(calls)
  })

  it('replaces the draft by one version per real change, not per keystroke', async () => {
    const jmapServer = makeFakeJmapServer()
    const { subject } = await openAndType(jmapServer)

    await user.type(subject, 'First')
    await pass(FIVE_MINUTES + 1000)
    await waitFor(() => {
      expect(draftsOf(jmapServer)).toHaveLength(1)
    })
    await user.type(subject, ' and second')
    await pass(FIVE_MINUTES + 1000)
    await waitFor(() => {
      expect(draftsOf(jmapServer).map(email => email.subject)).toEqual([
        'First and second'
      ])
    })
    // Two creations and one destruction in all
    const sets = jmapServer.callsOf('Email/set')
    expect(sets.filter(call => call.create !== undefined)).toHaveLength(2)
    expect(sets.filter(call => call.destroy !== undefined)).toHaveLength(1)
  })
})
