import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EmailBodyPart } from '@linagora/jmap-client-ts'

import { resolveConfig, type AppConfig } from '@common/config/config'
import { PlatformProvider } from '@common/features/platform/PlatformProvider'
import {
  FAKE_ACCOUNT_ID,
  makeBodyPart,
  makeFakeJmapServer
} from '@common/testing/fakeJmapServer'
import { makeFakeOidcAuthService } from '@common/testing/makeFakeAuthService'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { AttachmentList } from './AttachmentList'

jest.mock('cozy-external-bridge', () => ({
  CozyBridge: jest.fn(() => ({ isInIframe: () => false }))
}))

jest.setTimeout(15_000)

const WORKPLACE = 'https://alice.twake.example.com'
const DRIVE = 'https://alice-drive.twake.example.com'
const BLOB_ACCESS = 'com:linagora:params:jmap:unauthenticated:blob:access'
const ENDPOINT =
  'https://jmap.example.com/unauthenticatedDownload/{accountId}/{blobId}?token={token}'

function makeConfig(isSaveToDriveEnabled: boolean): AppConfig {
  const result = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      AUTH_MODE: 'basic',
      WORKPLACE_FQDN_FALLBACK: '{localpart}.twake.example.com',
      TDRIVE_ENABLED: true,
      SAVE_TO_DRIVE_ENABLED: isSaveToDriveEnabled
    },
    'https://mail.example.com'
  )
  if (!result.ok) throw new Error('Invalid configuration')
  return result.value
}

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' }
  })
}

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>()
const originalFetch = global.fetch
let intentCount = 0
const intentActions: string[] = []
/** Drive never answers the creation of an intent */
let hangsIntents = false
/** The LOOKUP intents of the list, apart from the others: `l1`, `l2`… */
const lookups: string[] = []

/** The Workplace of Alice, with Drive, answering the intents of the list */
beforeEach(() => {
  intentCount = 0
  intentActions.length = 0
  hangsIntents = false
  lookups.length = 0
  fetchMock.mockReset()
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input)
    if (url === `${WORKPLACE}/auth/token_exchange`) {
      return Promise.resolve(
        json({
          access_token: 'drive-token',
          refresh_token: 'drive-refresh',
          client_id: 'client',
          client_secret: 'secret'
        })
      )
    }
    if (url === `${WORKPLACE}/settings/flags`) {
      return Promise.resolve(json({ data: { attributes: {} } }))
    }
    if (url === `${WORKPLACE}/apps/`) {
      return Promise.resolve(
        json({
          data: ['home', 'drive'].map(slug => ({
            id: `io.cozy.apps/${slug}`,
            type: 'io.cozy.apps',
            attributes: { slug, name: slug, state: 'ready' },
            links: { related: `https://alice-${slug}.twake.example.com/` }
          }))
        })
      )
    }
    if (url === `${WORKPLACE}/intents`) {
      const body: unknown = JSON.parse(
        typeof init?.body === 'string' ? init.body : 'null'
      )
      const action = (body as { data: { attributes: { action: string } } }).data
        .attributes.action
      let id: string
      if (action === 'LOOKUP') {
        id = `l${lookups.length + 1}`
        lookups.push(id)
      } else {
        intentActions.push(action)
        if (hangsIntents) return new Promise<Response>(() => undefined)
        intentCount += 1
        id = `i${intentCount}`
      }
      return Promise.resolve(
        json({
          data: {
            id,
            type: 'io.cozy.intents',
            attributes: {
              action,
              type: 'io.cozy.files',
              services: [
                { slug: 'drive', href: `${DRIVE}/#/intents?intent=${id}` }
              ]
            }
          }
        })
      )
    }
    return Promise.reject(new Error(`Unexpected ${url}`))
  })
  global.fetch = fetchMock
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

afterAll(() => {
  global.fetch = originalFetch
})

async function frameOf(intentId: string): Promise<HTMLIFrameElement> {
  return waitFor(() => {
    const frame = document.querySelector<HTMLIFrameElement>(
      `iframe[src="${DRIVE}/#/intents?intent=${intentId}"]`
    )
    if (frame === null) throw new Error(`No frame for ${intentId}`)
    return frame
  })
}

function send(frame: HTMLIFrameElement, data: unknown): void {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin: DRIVE,
        source: frame.contentWindow
      })
    )
  })
}

/** Says ready, and returns what Mail sends the frame then */
function ready(frame: HTMLIFrameElement, intentId: string): jest.SpyInstance {
  const drive = frame.contentWindow
  if (drive === null) throw new Error('No window in the frame')
  const postMessage = jest.spyOn(drive, 'postMessage')
  send(frame, { type: `intent-${intentId}:ready` })
  return postMessage
}

const REPORT = makeBodyPart({
  disposition: 'attachment',
  blobId: 'b1',
  name: 'report.pdf',
  type: 'application/pdf',
  size: 1044
})
const PHOTO = makeBodyPart({
  disposition: 'attachment',
  blobId: 'b2',
  name: 'photo.png',
  type: 'image/png',
  size: 2048
})

function renderList(
  attachments: EmailBodyPart[],
  hasBlobAccess = true,
  refusesTokens = false,
  emailId: string | null = 'e1',
  isSaveToDriveEnabled = true
): { tokens: string[] } {
  const server = makeFakeJmapServer({
    capabilities: hasBlobAccess
      ? { [BLOB_ACCESS]: { endpoint: ENDPOINT, tokenTtlInSeconds: 300 } }
      : {}
  })
  const tokens: string[] = []
  server.handlers.set('UnauthenticatedBlobAccess/set', args => {
    const [blobId = ''] = Object.keys(args.create as Record<string, unknown>)
    tokens.push(blobId)
    if (refusesTokens) {
      return {
        accountId: FAKE_ACCOUNT_ID,
        notCreated: { [blobId]: { type: 'notFound' } }
      }
    }
    return {
      accountId: FAKE_ACCOUNT_ID,
      created: {
        [blobId]: { token: `tok-${blobId}`, validUntil: '2026-11-26T12:05:00Z' }
      }
    }
  })
  renderWithProviders(
    <PlatformProvider>
      <AttachmentList
        attachments={attachments}
        emailId={emailId ?? undefined}
      />
    </PlatformProvider>,
    {
      withJmapSession: true,
      jmapServer: server,
      config: makeConfig(isSaveToDriveEnabled),
      authService: makeFakeOidcAuthService({
        status: 'authenticated',
        user: { email: 'alice@example.com', name: 'Alice', workplaceFqdn: null }
      })
    }
  )
  return { tokens }
}

async function expectToast(text: string): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('toast')).toHaveTextContent(text)
  })
}

function downloadUrl(blobId: string): string {
  return `https://jmap.example.com/unauthenticatedDownload/${FAKE_ACCOUNT_ID}/${blobId}?token=tok-${blobId}`
}

describe('AttachmentList, save to Drive', () => {
  it('saves a file from a download token, then organizes it in Drive', async () => {
    const { tokens } = renderList([REPORT])
    const save = await screen.findByRole('button', {
      name: 'Save to my Drive report.pdf'
    })

    await userEvent.click(save)

    const upload = await frameOf('i1')
    expect(intentActions).toEqual(['UPLOAD'])
    expect(tokens).toEqual(['b1'])
    expect(ready(upload, 'i1')).toHaveBeenCalledWith(
      {
        url: downloadUrl('b1'),
        folderId: 'io.cozy.apps/mail',
        name: 'report.pdf',
        reference: {
          type: 'io.cozy.mails.attachments',
          id: `${FAKE_ACCOUNT_ID}:e1:b1`
        }
      },
      DRIVE
    )
    expect(
      screen.getByRole('button', { name: 'Saving to Drive… report.pdf' })
    ).toHaveFocus()

    send(upload, {
      type: 'intent-i1:done',
      document: {
        _id: 'file-1',
        name: 'report.pdf',
        dir_id: 'dir-mail',
        size: '1044'
      }
    })

    await expectToast('“report.pdf” saved to your Drive')
    expect(
      screen.getByRole('button', { name: 'See in Drive report.pdf' })
    ).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Organize' }))
    const moveFrame = await frameOf('i2')
    expect(intentActions).toEqual(['UPLOAD', 'MOVE'])
    expect(
      await screen.findByRole('dialog', { name: 'Twake Drive' })
    ).toBeVisible()
    expect(ready(moveFrame, 'i2')).toHaveBeenCalledWith(
      {
        fileIds: ['file-1'],
        defaultDirId: 'dir-mail',
        tabs: ['drive'],
        theme: { type: 'light' },
        confirmLabel: 'Save to'
      },
      DRIVE
    )

    send(moveFrame, {
      type: 'intent-i2:done',
      document: [
        { _id: 'file-1', name: 'report.pdf', path: '/Invoices/report.pdf' }
      ]
    })

    await expectToast('Moved to /Invoices/report.pdf')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Twake Drive' })).toBe(null)
    })
    expect(
      screen.getByRole('button', { name: 'See in Drive report.pdf' })
    ).toHaveFocus()
  })

  it('does not take a file of another size as saved', async () => {
    renderList([REPORT])
    await userEvent.click(
      await screen.findByRole('button', { name: 'Save to my Drive report.pdf' })
    )
    const upload = await frameOf('i1')
    ready(upload, 'i1')

    // A stack without SourceURL stores an empty file
    send(upload, {
      type: 'intent-i1:done',
      document: { _id: 'file-1', name: 'report.pdf', dir_id: 'd', size: '0' }
    })

    await expectToast(
      'Could not confirm that the file was saved. Check your Drive before trying again.'
    )
    expect(
      screen.getByRole('button', { name: 'Save to my Drive report.pdf' })
    ).toBeVisible()
  })

  it('saves all the files one after the other, each with its own token', async () => {
    const { tokens } = renderList([REPORT, PHOTO])

    await userEvent.click(
      await screen.findByRole('button', { name: 'Save all to Drive' })
    )

    const first = await frameOf('i1')
    ready(first, 'i1')
    expect(intentActions).toEqual(['UPLOAD'])
    send(first, {
      type: 'intent-i1:done',
      document: { _id: 'f1', name: 'report.pdf', dir_id: 'd', size: 1044 }
    })
    const second = await frameOf('i2')
    expect(ready(second, 'i2')).toHaveBeenCalledWith(
      {
        url: downloadUrl('b2'),
        folderId: 'io.cozy.apps/mail',
        name: 'photo.png',
        reference: {
          type: 'io.cozy.mails.attachments',
          id: `${FAKE_ACCOUNT_ID}:e1:b2`
        }
      },
      DRIVE
    )
    send(second, {
      type: 'intent-i2:done',
      document: { _id: 'f2', name: 'photo.png', dir_id: 'd', size: 2048 }
    })

    await expectToast('2 files saved to your Drive')
    expect(tokens).toEqual(['b1', 'b2'])
    expect(
      screen.getByRole('button', { name: 'See in Drive photo.png' })
    ).toBeVisible()
  })

  it('offers no save without download tokens on the mail server', async () => {
    renderList([REPORT], false)

    await screen.findByRole('button', { name: 'Download report.pdf' })
    // The platform client gets ready meanwhile
    await waitFor(() => {
      expect(fetchMock.mock.calls.map(([input]) => urlOf(input))).toContain(
        `${WORKPLACE}/apps/`
      )
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })
    expect(screen.queryByRole('button', { name: /Save to my Drive/ })).toBe(
      null
    )
    // Nothing to show: Drive is not asked either
    expect(lookups).toEqual([])
  })

  it('offers no save without SAVE_TO_DRIVE_ENABLED', async () => {
    renderList([REPORT, PHOTO], true, false, 'e1', false)

    await screen.findByRole('button', { name: 'Download report.pdf' })
    // Drive is there for the composer all the same
    await waitFor(() => {
      expect(fetchMock.mock.calls.map(([input]) => urlOf(input))).toContain(
        `${WORKPLACE}/apps/`
      )
    })
    expect(screen.queryByRole('button', { name: /Save to my Drive/ })).toBe(
      null
    )
    expect(screen.queryByRole('button', { name: 'Save all to Drive' })).toBe(
      null
    )
    expect(lookups).toEqual([])
  })

  it('opens a saved file in Drive', async () => {
    const open = jest.spyOn(window, 'open').mockReturnValue(null)
    renderList([REPORT])
    await userEvent.click(
      await screen.findByRole('button', { name: 'Save to my Drive report.pdf' })
    )
    const upload = await frameOf('i1')
    ready(upload, 'i1')
    send(upload, {
      type: 'intent-i1:done',
      document: { _id: 'file-1', name: 'report.pdf', dir_id: 'd', size: 1044 }
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'See in Drive report.pdf' })
    )

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith(
        `${DRIVE}/#/file/file-1`,
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  it('tells the file was not saved when the mail server refuses a token', async () => {
    renderList([REPORT], true, true)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Save to my Drive report.pdf' })
    )

    await expectToast(
      'Could not confirm that the file was saved. Check your Drive before trying again.'
    )
    expect(intentActions).toEqual([])
    expect(
      screen.getByRole('button', { name: 'Save to my Drive report.pdf' })
    ).toBeVisible()
  })

  it('tells the file was not saved when Drive answers an error', async () => {
    renderList([REPORT])
    await userEvent.click(
      await screen.findByRole('button', { name: 'Save to my Drive report.pdf' })
    )
    const upload = await frameOf('i1')
    ready(upload, 'i1')

    send(upload, {
      type: 'intent-i1:error',
      error: { message: 'Quota exceeded' }
    })

    await expectToast(
      'Could not confirm that the file was saved. Check your Drive before trying again.'
    )
    expect(
      screen.getByRole('button', { name: 'Save to my Drive report.pdf' })
    ).toBeVisible()
  })

  it('gives up on a Drive that never answers, and frees the button', async () => {
    jest.useFakeTimers({ advanceTimers: true })
    hangsIntents = true
    renderList([REPORT])
    await userEvent.click(
      await screen.findByRole('button', { name: 'Save to my Drive report.pdf' })
    )
    await waitFor(() => {
      expect(intentActions).toEqual(['UPLOAD'])
    })
    expect(
      screen.getByRole('button', { name: 'Saving to Drive… report.pdf' })
    ).toBeVisible()

    act(() => {
      jest.advanceTimersByTime(20_000)
    })

    await expectToast(
      'Could not confirm that the file was saved. Check your Drive before trying again.'
    )
    expect(
      screen.getByRole('button', { name: 'Save to my Drive report.pdf' })
    ).toBeVisible()
  })

  it('asks Drive in one intent which attachments are saved', async () => {
    const open = jest.spyOn(window, 'open').mockReturnValue(null)
    renderList([REPORT, PHOTO])

    const lookup = await frameOf('l1')
    expect(ready(lookup, 'l1')).toHaveBeenCalledWith(
      {
        references: ['b1', 'b2'].map(blobId => ({
          type: 'io.cozy.mails.attachments',
          id: `${FAKE_ACCOUNT_ID}:e1:${blobId}`
        }))
      },
      DRIVE
    )
    send(lookup, {
      type: 'intent-l1:done',
      document: {
        files: {
          [`${FAKE_ACCOUNT_ID}:e1:b1`]: {
            fileId: 'file-9',
            name: 'report.pdf',
            dirId: 'd',
            trashed: false
          },
          [`${FAKE_ACCOUNT_ID}:e1:b2`]: null
        }
      }
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'See in Drive report.pdf' })
    )
    await waitFor(() => {
      expect(open).toHaveBeenCalledWith(
        `${DRIVE}/#/file/file-9`,
        '_blank',
        'noopener,noreferrer'
      )
    })
    expect(
      screen.getByRole('button', { name: 'Save to my Drive photo.png' })
    ).toBeVisible()
    expect(lookups).toEqual(['l1'])
    expect(intentActions).toEqual([])
  })

  it('offers to save an attachment whose file is in the trash', async () => {
    renderList([REPORT])
    const lookup = await frameOf('l1')
    ready(lookup, 'l1')

    send(lookup, {
      type: 'intent-l1:done',
      document: {
        files: {
          [`${FAKE_ACCOUNT_ID}:e1:b1`]: {
            fileId: 'file-9',
            name: 'report.pdf',
            dirId: 'trash',
            trashed: true
          }
        }
      }
    })

    expect(
      await screen.findByRole('button', { name: 'Save to my Drive report.pdf' })
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: /See in Drive/ })).toBe(null)
  })

  it('offers to save, and saves, when Drive cannot tell', async () => {
    renderList([REPORT])
    const lookup = await frameOf('l1')
    ready(lookup, 'l1')
    send(lookup, { type: 'intent-l1:error', error: { message: 'Oops' } })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Save to my Drive report.pdf' })
    )
    const upload = await frameOf('i1')
    ready(upload, 'i1')
    send(upload, {
      type: 'intent-i1:done',
      document: { _id: 'file-1', name: 'report.pdf', dir_id: 'd', size: 1044 }
    })

    expect(
      await screen.findByRole('button', { name: 'See in Drive report.pdf' })
    ).toBeVisible()
  })

  it('keeps a file saved while Drive is still looking', async () => {
    renderList([REPORT])
    const lookup = await frameOf('l1')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Save to my Drive report.pdf' })
    )
    const upload = await frameOf('i1')
    ready(upload, 'i1')
    send(upload, {
      type: 'intent-i1:done',
      document: { _id: 'file-1', name: 'report.pdf', dir_id: 'd', size: 1044 }
    })
    await screen.findByRole('button', { name: 'See in Drive report.pdf' })
    // Drive looked before the file was stored
    ready(lookup, 'l1')
    send(lookup, {
      type: 'intent-l1:done',
      document: { files: { [`${FAKE_ACCOUNT_ID}:e1:b1`]: null } }
    })

    // The lookup is over once Drive's frame is gone
    await waitFor(() => {
      expect(
        document.querySelector(`iframe[src="${DRIVE}/#/intents?intent=l1"]`)
      ).toBe(null)
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(
      screen.getByRole('button', { name: 'See in Drive report.pdf' })
    ).toBeVisible()
  })

  it('asks Drive again for the other attachments once a save cut its lookup', async () => {
    renderList([REPORT, PHOTO])
    await frameOf('l1')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Save to my Drive report.pdf' })
    )
    const upload = await frameOf('i1')
    ready(upload, 'i1')
    send(upload, {
      type: 'intent-i1:done',
      document: { _id: 'file-1', name: 'report.pdf', dir_id: 'd', size: 1044 }
    })
    await screen.findByRole('button', { name: 'See in Drive report.pdf' })

    const again = await frameOf('l2')
    ready(again, 'l2')
    send(again, {
      type: 'intent-l2:done',
      document: {
        files: {
          [`${FAKE_ACCOUNT_ID}:e1:b1`]: {
            fileId: 'file-1',
            name: 'report.pdf',
            dirId: 'd',
            trashed: false
          },
          [`${FAKE_ACCOUNT_ID}:e1:b2`]: {
            fileId: 'file-7',
            name: 'photo.png',
            dirId: 'd',
            trashed: false
          }
        }
      }
    })

    expect(
      await screen.findByRole('button', { name: 'See in Drive photo.png' })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'See in Drive report.pdf' })
    ).toBeVisible()
  })

  it('saves the attachment of no email without a reference', async () => {
    renderList([REPORT], true, false, null)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Save to my Drive report.pdf' })
    )
    const upload = await frameOf('i1')

    expect(ready(upload, 'i1')).toHaveBeenCalledWith(
      {
        url: downloadUrl('b1'),
        folderId: 'io.cozy.apps/mail',
        name: 'report.pdf'
      },
      DRIVE
    )
    send(upload, {
      type: 'intent-i1:done',
      document: { _id: 'file-1', name: 'report.pdf', dir_id: 'd', size: 1044 }
    })
    expect(
      await screen.findByRole('button', { name: 'See in Drive report.pdf' })
    ).toBeVisible()
    expect(lookups).toEqual([])
  })
})
