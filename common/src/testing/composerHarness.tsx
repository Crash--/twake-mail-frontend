import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import {
  ComposerProvider,
  useComposer
} from '@common/features/composer/ComposerProvider'

import { makeFakeJmapServer, type FakeJmapServer } from './fakeJmapServer'
import { renderWithProviders } from './renderWithProviders'

// What the specs of ComposerForm share: they are split in several files, each
// in a fresh jsdom (one file of them all grew its heap until its last tests,
// the attachments, went over their timeout on a loaded machine; #368)

function Opener(): ReactElement {
  const { openComposer } = useComposer()
  return (
    <>
      <button
        type="button"
        onClick={() => {
          openComposer()
        }}
      >
        Compose
      </button>
      <button
        type="button"
        onClick={() => {
          openComposer({ draftId: 'draft-1' })
        }}
      >
        Open draft
      </button>
      <button
        type="button"
        onClick={() => {
          openComposer({ templateId: 'template-1' })
        }}
      >
        Open template
      </button>
      {(['reply', 'replyAll', 'forward'] as const).map(action => (
        <button
          key={action}
          type="button"
          onClick={() => {
            openComposer({ reply: { emailId: 'source-1', action } })
          }}
        >
          {`Answer ${action}`}
        </button>
      ))}
    </>
  )
}

export function renderComposer(
  jmapServer: FakeJmapServer = makeFakeJmapServer()
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <ComposerProvider>
      <Opener />
    </ComposerProvider>,
    { jmapServer, withJmapSession: true }
  )
}

export async function openComposer(name = 'Compose'): Promise<HTMLElement> {
  await userEvent.click(await screen.findByRole('button', { name }))
  const editor = await screen.findByRole('textbox', { name: 'Message body' })
  const composer = editor.closest('[role="dialog"]')
  if (!(composer instanceof HTMLElement)) throw new Error('No composer')
  return composer
}

export async function fill(
  composer: HTMLElement,
  { to, subject }: { to?: string; subject?: string }
): Promise<void> {
  if (to !== undefined) {
    await userEvent.type(
      within(composer).getByRole('combobox', { name: 'To' }),
      `${to},`
    )
  }
  if (subject !== undefined) {
    // Pasted: typing it costs about 40 ms a character (a render of the composer each), which
    // a loaded CI runner multiplies
    await userEvent.click(
      within(composer).getByRole('textbox', { name: 'Subject' })
    )
    await userEvent.paste(subject)
  }
}

export function draftsOf(server: FakeJmapServer): typeof server.emails {
  return server.emails.filter(email => 'mailbox-drafts' in email.mailboxIds)
}
