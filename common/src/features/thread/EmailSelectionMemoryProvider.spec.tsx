import { VirtuosoMockContext } from '@linagora/twake-mui'
import type { QueryClient } from '@tanstack/react-query'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { Outlet, Route, useNavigate, useParams } from 'react-router'

import { EmailView } from '@common/features/email/EmailView'
import { MailboxTree } from '@common/features/mailbox/MailboxTree'
import {
  FAKE_ACCOUNT_ID,
  makeEmail,
  makeEmailWithBody,
  makeFakeJmapServer,
  type FakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'
import { listEmailsOneByOne } from '@common/testing/emailsOneByOne'

import { EmailList } from './EmailList'
import { EmailSelectionMemoryProvider } from './EmailSelectionMemoryProvider'
import { EMAIL_LIST_PAGE_SIZE, threadKeys } from './queries'

const ROW_HEIGHT = 56

/** The back button of the browser */
function HistoryBackButton(): ReactElement {
  const navigate = useNavigate()
  const handleClick = (): void => {
    void navigate(-1)
  }
  return (
    <button type="button" onClick={handleClick}>
      History back
    </button>
  )
}

/** The open email replaces the list, as on phones and small tablets */
function MailScreen({
  viewportHeight
}: {
  viewportHeight: number
}): ReactElement {
  return (
    <EmailSelectionMemoryProvider>
      <VirtuosoMockContext.Provider
        value={{ viewportHeight, itemHeight: ROW_HEIGHT }}
      >
        <MailboxTree />
        <HistoryBackButton />
        <Outlet />
      </VirtuosoMockContext.Provider>
    </EmailSelectionMemoryProvider>
  )
}

function ListPage(): ReactElement {
  const { mailboxId = '' } = useParams()
  return <EmailList key={mailboxId} mailboxId={mailboxId} />
}

function ViewPage(): ReactElement {
  const { mailboxId = '', emailId = '' } = useParams()
  return (
    <EmailView
      key={emailId}
      emailId={emailId}
      mailboxId={mailboxId}
      backPath={`/mailbox/${encodeURIComponent(mailboxId)}`}
    />
  )
}

function renderMailScreen(
  server: FakeJmapServer,
  viewportHeight = 10_000
): QueryClient {
  return renderWithProviders(<MailScreen viewportHeight={viewportHeight} />, {
    route: '/mailbox/mailbox-inbox',
    path: '/',
    withJmapSession: true,
    jmapServer: server,
    childRoutes: (
      <>
        <Route path="mailbox/:mailboxId" element={<ListPage />} />
        <Route
          path="mailbox/:mailboxId/email/:emailId"
          element={<ViewPage />}
        />
      </>
    )
  }).queryClient
}

function makeServer(): FakeJmapServer {
  return makeFakeJmapServer({
    emails: ['First', 'Second', 'Third'].map((subject, index) =>
      makeEmailWithBody(
        {
          id: `e${index}`,
          subject,
          receivedAt: `2026-10-0${3 - index}T08:00:00Z`,
          keywords: { $seen: true }
        },
        { text: `Body of ${subject}` }
      )
    )
  })
}

function selectBox(subject: string): HTMLElement {
  return screen.getByRole('checkbox', { name: `Select ${subject}` })
}

/**
 * Selects the last two: the first row is opened, the list comes back on it
 * (a row further down would scroll, which the mocked table does not do)
 */
async function selectLastTwo(): Promise<void> {
  await screen.findByText('Third')
  await userEvent.click(selectBox('Second'))
  await userEvent.click(selectBox('Third'))
  await screen.findByTestId('selection-toolbar')
}

function folderLink(name: string): HTMLElement {
  return within(
    screen.getByRole('treeitem', { name: new RegExp(name) })
  ).getByRole('link')
}

async function openAndGoBack(subject: string): Promise<void> {
  await userEvent.click(screen.getByText(subject))
  await screen.findByTestId('email-view-subject', {}, { timeout: 5000 })
  await userEvent.click(screen.getByTestId('email-view-back-button'))
  await screen.findByText('First', {}, { timeout: 5000 })
}

describe('EmailSelectionMemoryProvider', () => {
  jest.setTimeout(30_000)
  listEmailsOneByOne()

  it('keeps the selection while an email opened from the list is shown', async () => {
    renderMailScreen(makeServer())
    await selectLastTwo()

    await openAndGoBack('First')

    expect(selectBox('First')).not.toBeChecked()
    expect(selectBox('Second')).toBeChecked()
    expect(selectBox('Third')).toBeChecked()
    expect(screen.getByTestId('selection-toolbar-count')).toHaveTextContent('2')
  })

  it('drops the emails that left the list meanwhile', async () => {
    const server = makeServer()
    const queryClient = renderMailScreen(server)
    await selectLastTwo()
    await userEvent.click(screen.getByText('First'))
    await screen.findByTestId('email-view-subject', {}, { timeout: 5000 })

    // Gone elsewhere: the list is read again when shown (no push here)
    server.destroyEmail('e1')
    await queryClient.invalidateQueries({
      queryKey: threadKeys.all(FAKE_ACCOUNT_ID)
    })
    await userEvent.click(screen.getByTestId('email-view-back-button'))
    await screen.findByText('First', {}, { timeout: 5000 })
    await waitFor(() => {
      expect(screen.queryByText('Second')).toBe(null)
    })

    expect(selectBox('Third')).toBeChecked()
    expect(screen.getByTestId('selection-toolbar-count')).toHaveTextContent('1')
  })

  it('forgets the selection once another folder is shown', async () => {
    renderMailScreen(makeServer())
    await selectLastTwo()

    await userEvent.click(folderLink('Sent'))
    await waitFor(
      () => {
        expect(screen.queryByText('First')).toBe(null)
      },
      { timeout: 5000 }
    )
    await userEvent.click(folderLink('Inbox'))
    await screen.findByText('First', {}, { timeout: 5000 })

    expect(selectBox('First')).not.toBeChecked()
    expect(selectBox('Second')).not.toBeChecked()
    expect(screen.queryByTestId('selection-toolbar')).toBe(null)
  })
})

describe('scroll position of the list', () => {
  jest.setTimeout(30_000)
  listEmailsOneByOne()

  // Two pages: the email opened is past the first one
  const total = EMAIL_LIST_PAGE_SIZE * 2

  // The layout jsdom lacks: virtuoso scrolls only an element with a height,
  // within its scroll height, and learns where it is from its scroll event
  const viewportHeight = ROW_HEIGHT * 10
  beforeEach(() => {
    jest
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockReturnValue(viewportHeight)
    jest
      .spyOn(Element.prototype, 'scrollHeight', 'get')
      .mockReturnValue(ROW_HEIGHT * total)
    Element.prototype.scrollTo = function scrollTo(
      this: Element,
      options?: ScrollToOptions | number
    ): void {
      if (typeof options !== 'object') return
      fireEvent.scroll(this, { target: { scrollTop: options.top ?? 0 } })
    }
  })
  afterEach(() => {
    jest.restoreAllMocks()
    Reflect.deleteProperty(Element.prototype, 'scrollTo')
  })

  function makeLongServer(): FakeJmapServer {
    return makeFakeJmapServer({
      emails: Array.from({ length: total }, (_, index) =>
        makeEmail({
          id: `e${index}`,
          subject: `Email ${index}`,
          receivedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, total - index))
            .toISOString()
            .replace('.000', ''),
          keywords: { $seen: true }
        })
      )
    })
  }

  function scroller(): Element {
    const element = document.querySelector('[data-virtuoso-scroller]')
    if (element === null) throw new Error('No scroller')
    return element
  }

  /** Scrolls the list to `scrollTop`, its next page loaded, and opens `subject` */
  async function scrollAndOpen(
    scrollTop: number,
    subject: string
  ): Promise<void> {
    await screen.findByText('Email 0')
    await waitFor(() => {
      fireEvent.scroll(scroller(), { target: { scrollTop } })
      expect(screen.getByText(subject)).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText(subject))
    await screen.findByTestId('email-view-subject', {}, { timeout: 5000 })
  }

  const scrollTop = ROW_HEIGHT * (EMAIL_LIST_PAGE_SIZE + 5)

  it('is kept when the back button of the app goes back to the list', async () => {
    renderMailScreen(makeLongServer(), viewportHeight)
    await scrollAndOpen(scrollTop, `Email ${EMAIL_LIST_PAGE_SIZE + 7}`)

    await userEvent.click(screen.getByTestId('email-view-back-button'))

    await waitFor(() => {
      expect(scroller().scrollTop).toBe(scrollTop)
    })
  })

  it('is kept when the back button of the browser goes back to the list', async () => {
    renderMailScreen(makeLongServer(), viewportHeight)
    await scrollAndOpen(scrollTop, `Email ${EMAIL_LIST_PAGE_SIZE + 7}`)

    await userEvent.click(screen.getByRole('button', { name: 'History back' }))

    await waitFor(() => {
      expect(scroller().scrollTop).toBe(scrollTop)
    })
  })

  it('starts at the top when the folder is opened from the sidebar', async () => {
    renderMailScreen(makeLongServer(), viewportHeight)
    await scrollAndOpen(scrollTop, `Email ${EMAIL_LIST_PAGE_SIZE + 7}`)

    await userEvent.click(folderLink('Inbox'))

    await screen.findByText('Email 0', {}, { timeout: 5000 })
    expect(scroller().scrollTop).toBe(0)
  })

  it('starts at the top when the browser goes back from another folder', async () => {
    renderMailScreen(makeLongServer(), viewportHeight)
    await screen.findByText('Email 0')
    await waitFor(() => {
      fireEvent.scroll(scroller(), { target: { scrollTop } })
      expect(screen.getByText('Email 37')).toBeInTheDocument()
    })
    await userEvent.click(folderLink('Sent'))
    await waitFor(
      () => {
        expect(screen.queryByText('Email 0')).toBe(null)
      },
      { timeout: 5000 }
    )

    await userEvent.click(screen.getByRole('button', { name: 'History back' }))

    await screen.findByText('Email 0', {}, { timeout: 5000 })
    expect(scroller().scrollTop).toBe(0)
  })

  it('shows the row of the email the user comes back from when it was not in view', async () => {
    renderMailScreen(makeLongServer(), viewportHeight)
    const opened = EMAIL_LIST_PAGE_SIZE + 7
    await scrollAndOpen(scrollTop, `Email ${opened}`)

    // From email to email, far above the rows in view
    const last = opened - 15
    for (let index = opened - 1; index >= last; index -= 1) {
      await userEvent.click(screen.getByTestId('email-view-previous-button'))
      await waitFor(
        () => {
          expect(screen.getByTestId('email-view-subject')).toHaveTextContent(
            `Email ${index}`
          )
        },
        { timeout: 5000 }
      )
    }
    await userEvent.click(screen.getByTestId('email-view-back-button'))

    const row = await screen.findByText(`Email ${last}`)
    await waitFor(() => {
      expect(row.closest('tr')?.querySelector('a')).toHaveFocus()
    })
    expect(scroller().scrollTop).not.toBe(scrollTop)
  })
})
