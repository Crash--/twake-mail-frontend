import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Route, useParams } from 'react-router'

import {
  AFTER_MOVE_PREFERENCE_STORAGE_KEY,
  type AfterMovePreference
} from '@common/features/settings/afterMovePreference'
import { THREAD_PREFERENCE_STORAGE_KEY } from '@common/features/settings/threadPreference'
import { ShortcutsProvider } from '@common/features/shortcuts/ShortcutsProvider'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'
import {
  makeEmail,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import {
  renderWithProviders,
  type RenderWithProvidersResult
} from '@common/testing/renderWithProviders'

import { EmailView } from './EmailView'

/** As `EmailPage`: the email of the URL */
function EmailRoute(): ReactElement {
  const { mailboxId = '', emailId = '' } = useParams()
  return (
    <EmailView
      key={emailId}
      emailId={emailId}
      mailboxId={mailboxId}
      backPath={`/mailbox/${mailboxId}`}
    />
  )
}

/** The Inbox, the most recent first: e1, e2, e3 */
function makeInbox(
  ids: readonly string[] = ['e1', 'e2', 'e3']
): FakeJmapServer {
  return makeFakeJmapServer({
    emails: ids.map((id, index) =>
      makeEmail({
        id,
        subject: `Subject ${id}`,
        receivedAt: `2026-10-0${String(9 - index)}T08:30:00Z`
      })
    )
  })
}

function renderEmail(
  jmapServer: FakeJmapServer,
  emailId: string
): RenderWithProvidersResult {
  return renderWithProviders(
    <ShortcutsProvider>
      <EmailRoute />
    </ShortcutsProvider>,
    {
      route: `/mailbox/mailbox-inbox/email/${emailId}`,
      path: '/mailbox/:mailboxId/email/:emailId',
      withJmapSession: true,
      jmapServer,
      routes: <Route path="/mailbox/:mailboxId" element={<p>The list</p>} />
    }
  )
}

function prefer(preference: AfterMovePreference): void {
  window.localStorage.setItem(AFTER_MOVE_PREFERENCE_STORAGE_KEY, preference)
}

/** The email open, its list loaded (the "Next email" button knows) */
async function openEmail(
  jmapServer: FakeJmapServer,
  emailId: string
): Promise<RenderWithProvidersResult> {
  const result = renderEmail(jmapServer, emailId)
  expect(await screen.findByTestId('email-view-subject')).toHaveTextContent(
    `Subject ${emailId}`
  )
  await waitFor(() => {
    expect(
      [
        screen.getByTestId('email-view-previous-button'),
        screen.getByTestId('email-view-next-button')
      ].some(button => !button.hasAttribute('disabled'))
    ).toBe(true)
  })
  return result
}

async function moveToTrash(): Promise<void> {
  await userEvent.click(
    await screen.findByTestId('email-view-action-move-to-trash')
  )
}

/** The subject of the email open, which has the focus */
async function findOpenSubject(emailId: string): Promise<HTMLElement> {
  const subject = await screen.findByRole('heading', {
    level: 1,
    name: `Subject ${emailId}`
  })
  await waitFor(() => {
    expect(subject).toHaveFocus()
  })
  return subject
}

describe('after deleting or moving the open email', () => {
  listEmailsOneByOne()

  afterEach(() => {
    window.localStorage.removeItem(AFTER_MOVE_PREFERENCE_STORAGE_KEY)
  })

  it('goes back to the list by default', async () => {
    const jmapServer = makeInbox()
    await openEmail(jmapServer, 'e2')

    await moveToTrash()

    expect(await screen.findByText('The list')).toBeInTheDocument()
  })

  it('opens the next email when the user wants it', async () => {
    prefer('next')
    const jmapServer = makeInbox()
    await openEmail(jmapServer, 'e2')

    await moveToTrash()

    expect(await findOpenSubject('e3')).toBeInTheDocument()
    expect(screen.queryByText('The list')).toBe(null)
    expect(
      jmapServer.emails.find(email => email.id === 'e2')?.mailboxIds
    ).toEqual({ 'mailbox-trash': true })
  })

  it('opens the previous email when the user wants it', async () => {
    prefer('previous')
    const jmapServer = makeInbox()
    await openEmail(jmapServer, 'e2')

    await moveToTrash()

    expect(await findOpenSubject('e1')).toBeInTheDocument()
    expect(screen.queryByText('The list')).toBe(null)
  })

  it('opens the one above when the last email leaves', async () => {
    prefer('next')
    const jmapServer = makeInbox()
    await openEmail(jmapServer, 'e3')

    await moveToTrash()

    expect(await findOpenSubject('e2')).toBeInTheDocument()
    expect(screen.queryByText('The list')).toBe(null)
  })

  it('goes back to the list when the only email leaves', async () => {
    prefer('next')
    const jmapServer = makeInbox(['e1'])
    renderEmail(jmapServer, 'e1')
    await screen.findByTestId('email-view-subject')

    await moveToTrash()

    expect(await screen.findByText('The list')).toBeInTheDocument()
  })

  it('follows the preference with the keyboard shortcut', async () => {
    prefer('next')
    const jmapServer = makeInbox()
    await openEmail(jmapServer, 'e2')

    await userEvent.keyboard('#')

    expect(await findOpenSubject('e3')).toBeInTheDocument()
    expect(screen.queryByText('The list')).toBe(null)
  })

  it('goes back to the list when another client moves the email', async () => {
    prefer('next')
    const jmapServer = makeInbox()
    const { queryClient } = await openEmail(jmapServer, 'e2')

    const moved = jmapServer.emails.find(email => email.id === 'e2')
    if (moved) moved.mailboxIds = { 'mailbox-trash': true }
    await act(async () => {
      await queryClient.invalidateQueries()
    })

    expect(await screen.findByText('The list')).toBeInTheDocument()
  })

  describe('with conversations', () => {
    beforeEach(() => {
      window.localStorage.setItem(THREAD_PREFERENCE_STORAGE_KEY, 'true')
    })

    it('opens the next conversation once the open one is moved to Trash', async () => {
      prefer('next')
      const jmapServer = makeInbox()
      renderEmail(jmapServer, 'e2')
      await screen.findByTestId('conversation-view')
      await waitFor(() => {
        expect(screen.getByTestId('email-view-next-button')).toBeEnabled()
      })

      await userEvent.click(screen.getByTestId('conversation-more-button'))
      await userEvent.click(
        await screen.findByTestId('conversation-move-to-trash')
      )

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Subject e3' })
      ).toBeInTheDocument()
      expect(screen.queryByText('The list')).toBe(null)
    })
  })
})
