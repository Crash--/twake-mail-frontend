import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { resolveConfig, type AppConfig } from '@common/config/config'
import {
  fill,
  openComposer,
  renderComposer
} from '@common/testing/composerHarness'
import { makeFakeJmapServer } from '@common/testing/fakeJmapServer'
import {
  installFakeUploads,
  type FakeUploads
} from '@common/testing/fakeUploads'
import { makeFakeOidcAuthService } from '@common/testing/makeFakeAuthService'

import { clearComposerStorage } from './composerStorage'

jest.mock('cozy-external-bridge', () => ({
  CozyBridge: jest.fn(() => ({ isInIframe: () => false }))
}))

jest.setTimeout(15_000)

const WORKPLACE = 'https://alice.twake.example.com'
const DRIVE = 'https://alice-drive.twake.example.com'
const LINK = `${DRIVE}/public?sharecode=s3cr3t`

function makeConfig(): AppConfig {
  const result = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      AUTH_MODE: 'basic',
      WORKPLACE_FQDN_FALLBACK: '{localpart}.twake.example.com',
      TDRIVE_ENABLED: true
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

/** The Workplace of Alice, with Drive, answering the intents of the composer */
beforeEach(() => {
  intentCount = 0
  fetchMock.mockReset()
  fetchMock.mockImplementation(input => {
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
      intentCount += 1
      const id = `i${intentCount}`
      return Promise.resolve(
        json({
          data: {
            id,
            type: 'io.cozy.intents',
            attributes: {
              action: 'UPLOAD',
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

afterAll(() => {
  global.fetch = originalFetch
})

function intentBodies(): unknown[] {
  return fetchMock.mock.calls
    .filter(([url]) => urlOf(url) === `${WORKPLACE}/intents`)
    .map(([, init]): unknown =>
      JSON.parse(typeof init?.body === 'string' ? init.body : 'null')
    )
}

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

function signedIn(): {
  config: AppConfig
  authService: ReturnType<typeof makeFakeOidcAuthService>
} {
  return {
    config: makeConfig(),
    authService: makeFakeOidcAuthService({
      status: 'authenticated',
      user: { email: 'alice@example.com', name: 'Alice', workplaceFqdn: null }
    })
  }
}

const HUGE = 20_000_001

describe('ComposerForm, files over the size limit', () => {
  let uploads: FakeUploads | null = null

  afterEach(() => {
    uploads?.restore()
    uploads = null
    void clearComposerStorage()
  })

  it('sends them to Twake Drive and inserts a link card for each', async () => {
    const jmapServer = makeFakeJmapServer()
    uploads = installFakeUploads(jmapServer)
    renderComposer(jmapServer, signedIn())
    const composer = await openComposer()
    await within(composer).findByTestId('composer-drive-button')
    const huge = new File([new Uint8Array(HUGE)], 'huge.bin')

    await userEvent.upload(
      within(composer).getByTestId('composer-file-input'),
      huge
    )

    const dialog = await screen.findByRole('dialog', { name: 'Attaching file' })
    expect(dialog).toHaveAccessibleDescription(
      'Your file is larger than 20 MB. It will be uploaded to Twake Drive and attached as a link.'
    )
    expect(screen.queryByRole('dialog', { name: 'Maximum files size' })).toBe(
      null
    )
    expect(uploads.received).toEqual([])
    expect(intentBodies()).toEqual([
      {
        data: {
          type: 'io.cozy.intents',
          attributes: {
            action: 'UPLOAD',
            type: 'io.cozy.files',
            permissions: []
          }
        }
      }
    ])
    const frame = await frameOf('i1')
    const drive = frame.contentWindow
    if (drive === null) throw new Error('No window in the frame')
    const postMessage = jest.spyOn(drive, 'postMessage')

    send(frame, { type: 'intent-i1:ready' })
    expect(postMessage).toHaveBeenCalledWith(
      {
        folderId: 'io.cozy.apps/mail',
        files: [huge],
        sharingLink: true,
        progress: true
      },
      DRIVE
    )
    send(frame, {
      type: 'intent-i1:result',
      result: { index: 0, loaded: 5, total: 10 }
    })
    expect(
      within(dialog).getByRole('progressbar', { name: 'Uploading huge.bin' })
    ).toHaveAttribute('aria-valuenow', '50')

    send(frame, {
      type: 'intent-i1:done',
      document: [
        {
          id: 'file-1',
          name: 'huge.bin',
          size: HUGE,
          mimeType: 'application/octet-stream',
          sharingLink: LINK
        }
      ]
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Attaching file' })).toBe(
        null
      )
    })
    const card = composer.querySelector('a.tmail-file-link-card')
    expect(card).toHaveAttribute('href', LINK)
    expect(card).toHaveTextContent('huge.bin')
    expect(within(composer).queryByTestId('composer-attachment-item')).toBe(
      null
    )
  })

  it('says which files Drive could not take, and inserts the others', async () => {
    renderComposer(makeFakeJmapServer(), signedIn())
    const composer = await openComposer()
    await within(composer).findByTestId('composer-drive-button')

    await userEvent.upload(
      within(composer).getByTestId('composer-file-input'),
      [
        new File([new Uint8Array(HUGE)], 'first.bin'),
        new File([new Uint8Array(HUGE)], 'second.bin')
      ]
    )

    const first = await frameOf('i1')
    send(first, { type: 'intent-i1:ready' })
    send(first, {
      type: 'intent-i1:error',
      error: { name: 'Error', message: 'Quota exceeded', status: 413 }
    })
    const second = await frameOf('i2')
    send(second, { type: 'intent-i2:ready' })
    send(second, {
      type: 'intent-i2:done',
      document: [{ id: 'file-2', name: 'second.bin', sharingLink: LINK }]
    })

    await waitFor(() => {
      expect(composer.querySelectorAll('a.tmail-file-link-card')).toHaveLength(
        1
      )
    })
    // The dialog stays to say which file failed, until closed
    const dialog = screen.getByRole('dialog', { name: 'Attaching file' })
    expect(
      within(dialog).getByText('Some files could not be uploaded to Drive.')
    ).toHaveAttribute('role', 'alert')
    expect(within(dialog).getByText('Upload failed')).toBeVisible()
    expect(within(dialog).getByText('first.bin')).toBeVisible()
    expect(within(dialog).queryByText('second.bin')).toBe(null)
    // Its text button: the close cross of its title and of the toast shown
    // in it are named Close too
    await userEvent.click(
      within(dialog).getByText('Close', { selector: 'button' })
    )
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Attaching file' })).toBe(
        null
      )
    })
  })

  it('cancels a file, and all of them', async () => {
    renderComposer(makeFakeJmapServer(), signedIn())
    const composer = await openComposer()
    await within(composer).findByTestId('composer-drive-button')

    await userEvent.upload(
      within(composer).getByTestId('composer-file-input'),
      [
        new File([new Uint8Array(HUGE)], 'first.bin'),
        new File([new Uint8Array(HUGE)], 'second.bin'),
        new File([new Uint8Array(HUGE)], 'third.bin')
      ]
    )
    const dialog = await screen.findByRole('dialog', { name: 'Attaching file' })
    await frameOf('i1')

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel first.bin' })
    )
    await frameOf('i2')
    expect(document.querySelector(`iframe[src*="intent=i1"]`)).toBe(null)
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' })
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Attaching file' })).toBe(
        null
      )
    })
    expect(document.querySelector('iframe[src*="intents"]')).toBe(null)
    expect(intentBodies()).toHaveLength(2)
    expect(composer.querySelector('a.tmail-file-link-card')).toBe(null)
  })

  it('keeps the size alert without Drive', async () => {
    const jmapServer = makeFakeJmapServer()
    uploads = installFakeUploads(jmapServer)
    renderComposer(jmapServer)
    const composer = await openComposer()

    await userEvent.upload(
      within(composer).getByTestId('composer-file-input'),
      new File([new Uint8Array(HUGE)], 'huge.bin')
    )

    expect(
      await screen.findByRole('dialog', { name: 'Maximum files size' })
    ).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalledWith(
      `${WORKPLACE}/intents`,
      expect.anything()
    )
  })

  it('does not send while files go to Drive, then sends with their card', async () => {
    renderComposer(makeFakeJmapServer(), signedIn())
    const composer = await openComposer()
    await within(composer).findByTestId('composer-drive-button')
    await fill(composer, { to: 'alice@example.com', subject: 'Survey' })
    await userEvent.upload(
      within(composer).getByTestId('composer-file-input'),
      new File([new Uint8Array(HUGE)], 'huge.bin')
    )
    const dialog = await screen.findByRole('dialog', { name: 'Attaching file' })
    const frame = await frameOf('i1')
    send(frame, { type: 'intent-i1:ready' })

    await userEvent.keyboard('{Control>}{Enter}{/Control}')

    expect(dialog).toBeVisible()
    // Not sent: the composer stays, under the modal dialog
    expect(composer).toBeInTheDocument()
    expect(within(dialog).getByText('Uploading huge.bin')).toHaveAttribute(
      'role',
      'status'
    )
    send(frame, {
      type: 'intent-i1:done',
      document: [{ id: 'file-1', name: 'huge.bin', sharingLink: LINK }]
    })
    await waitFor(() => {
      expect(composer.querySelector('a.tmail-file-link-card')).not.toBe(null)
    })
  })

  it('sends the whole batch when the files together go over the limit', async () => {
    const jmapServer = makeFakeJmapServer({ maxSizeAttachmentsPerEmail: 1000 })
    uploads = installFakeUploads(jmapServer)
    renderComposer(jmapServer, signedIn())
    const composer = await openComposer()
    await within(composer).findByTestId('composer-drive-button')
    await userEvent.upload(
      within(composer).getByTestId('composer-file-input'),
      new File([new Uint8Array(600)], 'first.txt')
    )
    await waitFor(() => {
      expect(uploads?.received).toHaveLength(1)
    })

    await userEvent.upload(
      within(composer).getByTestId('composer-file-input'),
      [
        new File([new Uint8Array(100)], 'small.txt'),
        new File([new Uint8Array(500)], 'second.txt')
      ]
    )

    const dialog = await screen.findByRole('dialog', { name: 'Attaching file' })
    expect(within(dialog).getByText('small.txt')).toBeVisible()
    expect(within(dialog).getByText('second.txt')).toBeVisible()
    expect(uploads.received).toHaveLength(1)
  })

  it('keeps the card of a file stored before the cancel', async () => {
    renderComposer(makeFakeJmapServer(), signedIn())
    const composer = await openComposer()
    await within(composer).findByTestId('composer-drive-button')
    await userEvent.upload(
      within(composer).getByTestId('composer-file-input'),
      [
        new File([new Uint8Array(HUGE)], 'first.bin'),
        new File([new Uint8Array(HUGE)], 'second.bin')
      ]
    )
    const dialog = await screen.findByRole('dialog', { name: 'Attaching file' })
    const first = await frameOf('i1')
    send(first, { type: 'intent-i1:ready' })
    send(first, {
      type: 'intent-i1:done',
      document: [{ id: 'file-1', name: 'first.bin', sharingLink: LINK }]
    })
    await frameOf('i2')

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Cancel' })
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Attaching file' })).toBe(
        null
      )
    })
    const cards = composer.querySelectorAll('a.tmail-file-link-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]).toHaveTextContent('first.bin')
  })

  it('stops the files left when the composer goes away', async () => {
    const { unmount } = renderComposer(makeFakeJmapServer(), signedIn())
    const composer = await openComposer()
    await within(composer).findByTestId('composer-drive-button')
    await userEvent.upload(
      within(composer).getByTestId('composer-file-input'),
      [
        new File([new Uint8Array(HUGE)], 'first.bin'),
        new File([new Uint8Array(HUGE)], 'second.bin')
      ]
    )
    await frameOf('i1')

    unmount()
    // Time for a next file to ask for its intent, were it sent
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 500))
    })

    expect(intentBodies()).toHaveLength(1)
  })

  describe('a Drive that does not answer', () => {
    beforeEach(() => {
      jest.useFakeTimers({ advanceTimers: true })
    })
    afterEach(() => {
      jest.useRealTimers()
    })

    it.each([
      ['never gets ready', false, 20_000],
      ['stops sending progress', true, 60_000]
    ])('fails a file whose Drive frame %s', async (_, isReady, delay) => {
      renderComposer(makeFakeJmapServer(), signedIn())
      const composer = await openComposer()
      await within(composer).findByTestId('composer-drive-button')
      await userEvent.upload(
        within(composer).getByTestId('composer-file-input'),
        new File([new Uint8Array(HUGE)], 'huge.bin')
      )
      const dialog = await screen.findByRole('dialog', {
        name: 'Attaching file'
      })
      const frame = await frameOf('i1')
      if (isReady) send(frame, { type: 'intent-i1:ready' })

      act(() => {
        jest.advanceTimersByTime(delay)
      })

      expect(
        await within(dialog).findByText(
          'Some files could not be uploaded to Drive.'
        )
      ).toHaveAttribute('role', 'alert')
      expect(document.querySelector('iframe[src*="intents"]')).toBe(null)
    })
  })
})
