import { screen } from '@testing-library/react'
import { useState, type ReactElement } from 'react'

import {
  makeDefaultMailboxes,
  makeEmail,
  makeFakeJmapServer,
  makeTeamMailboxes
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { EmailActionsMenu } from './EmailActionsMenu'

const EMAIL = {
  id: 'e1',
  mailboxIds: { 'team-drafts': true as const },
  keywords: {}
}

function Menu({ mailboxId }: { mailboxId: string }): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <button
        type="button"
        ref={setAnchor}
        // The menu opens under the button
      >
        Anchor
      </button>
      <EmailActionsMenu
        anchor={anchor === null ? null : { element: anchor }}
        onClose={() => undefined}
        emails={[EMAIL]}
        mailboxId={mailboxId}
      />
    </>
  )
}

function renderMenu(mailboxId: string): void {
  renderWithProviders(<Menu mailboxId={mailboxId} />, {
    withJmapSession: true,
    jmapServer: makeFakeJmapServer({
      mailboxes: [...makeDefaultMailboxes(), ...makeTeamMailboxes()],
      emails: [makeEmail({ id: 'e1', mailboxIds: { [mailboxId]: true } })]
    })
  })
}

describe('EmailActionsMenu', () => {
  it('offers no reply nor forward in the Drafts of a team mailbox', async () => {
    renderMenu('team-drafts')

    expect(
      await screen.findByTestId('email-action-delete-permanently')
    ).toBeVisible()
    expect(screen.queryByTestId('email-action-reply')).toBe(null)
    expect(screen.queryByTestId('email-action-forward')).toBe(null)
  })

  it('offers them in the Inbox of a team mailbox', async () => {
    renderMenu('team-inbox')

    expect(await screen.findByTestId('email-action-reply')).toBeVisible()
    expect(screen.getByTestId('email-action-forward')).toBeVisible()
  })
})
