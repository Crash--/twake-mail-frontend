import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import {
  ComposerProvider,
  useComposer
} from '@common/features/composer/ComposerProvider'

import { makeFakeJmapServer, type FakeJmapServer } from './fakeJmapServer'
import { renderWithProviders } from './renderWithProviders'

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

export function draftsOf(server: FakeJmapServer): typeof server.emails {
  return server.emails.filter(email => 'mailbox-drafts' in email.mailboxIds)
}
