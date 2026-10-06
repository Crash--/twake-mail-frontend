import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import type { SpaceOverlay } from '@/ds/SpaceOverlay/spaceOverlay'
import { AppConfigProvider } from '@common/config/AppConfigProvider'
import { resolveConfig } from '@common/config/config'
import { DRIVE_ATTACHMENT_PREFERENCE_STORAGE_KEY } from '@common/features/settings/driveAttachmentPreference'
import { makeFakeOidcAuthService } from '@common/testing/makeFakeAuthService'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { DriveAttachButton } from './DriveAttachButton'

const DRIVE = 'https://alice.twake.example.com'
const PICKER = 'https://alice-drive.twake.example.com'

function withConfig(ui: ReactElement, enabled = true): ReactElement {
  const result = resolveConfig(
    {
      SERVER_URL: 'https://jmap.example.com',
      AUTH_MODE: 'basic',
      TDRIVE_ENABLED: enabled,
      TDRIVE_INTENT_URL: 'https://{localpart}.twake.example.com'
    },
    'https://mail.example.com'
  )
  if (!result.ok) throw new Error('Invalid configuration')
  return <AppConfigProvider config={result.value}>{ui}</AppConfigProvider>
}

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>()
let refusesExchange = false
const originalFetch = global.fetch

beforeEach(() => {
  fetchMock.mockReset()
  refusesExchange = false
  fetchMock.mockImplementation(input => {
    const url = urlOf(input)
    if (url === `${DRIVE}/auth/token_exchange`) {
      return Promise.resolve(
        refusesExchange
          ? json(
              { error: 'the origin of this application is not allowed' },
              403
            )
          : json({ access_token: 'drive-token' })
      )
    }
    if (url.startsWith(`${DRIVE}/intents`)) {
      return Promise.resolve(
        json({
          data: {
            id: 'i1',
            attributes: {
              services: [{ href: `${PICKER}/#/intents?intent=i1` }]
            }
          }
        })
      )
    }
    if (url === `${DRIVE}/files/downloads/s3cr3t/notes.txt`) {
      return Promise.resolve(new Response('Hello', { status: 200 }))
    }
    return Promise.reject(new Error(`Unexpected ${url}`))
  })
  global.fetch = fetchMock
})

afterAll(() => {
  global.fetch = originalFetch
})

function renderButton(
  enabled = true,
  overlay?: SpaceOverlay
): {
  onLinks: jest.Mock
  onAttach: jest.Mock
  unmount: () => void
} {
  const onLinks = jest.fn()
  const onAttach = jest.fn()
  const { unmount } = renderWithProviders(
    withConfig(
      <DriveAttachButton
        maxFileSize={1000}
        onLinks={onLinks}
        onAttach={onAttach}
      />,
      enabled
    ),
    {
      authService: makeFakeOidcAuthService({
        status: 'authenticated',
        user: { email: 'alice@example.com', name: 'Alice', workplaceFqdn: null }
      }),
      withJmapSession: true,
      overlay
    }
  )
  return { onLinks, onAttach, unmount }
}

async function openPicker(): Promise<HTMLIFrameElement> {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Attach from Drive' })
  )
  const dialog = await screen.findByRole('dialog', { name: 'Twake Drive' })
  expect(dialog).toBeVisible()
  const frame = await screen.findByTitle('Twake Drive file picker')
  // SAFETY: found by its title, the iframe of the picker
  return frame as HTMLIFrameElement
}

function send(frame: HTMLIFrameElement, data: unknown, origin = PICKER): void {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', { data, origin, source: frame.contentWindow })
    )
  })
}

describe('DriveAttachButton', () => {
  it('is hidden once turned off in the preferences', async () => {
    window.localStorage.setItem(
      DRIVE_ATTACHMENT_PREFERENCE_STORAGE_KEY,
      'false'
    )
    try {
      renderButton()
      await waitFor(() => {
        expect(screen.queryByTestId('composer-drive-button')).toBeNull()
      })
    } finally {
      window.localStorage.removeItem(DRIVE_ATTACHMENT_PREFERENCE_STORAGE_KEY)
    }
  })

  it('opens the picker with a Drive token, answers it at its origin only', async () => {
    renderButton()
    const frame = await openPicker()

    expect(frame).toHaveAttribute('src', `${PICKER}/#/intents?intent=i1`)
    expect(screen.getByRole('status')).toHaveTextContent('Opening Twake Drive…')
    const [, init] = fetchMock.mock.calls[1] ?? []
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer drive-token'
    )
    const picker = frame.contentWindow
    if (picker === null) throw new Error('No window in the frame')
    const postMessage = jest.spyOn(picker, 'postMessage')

    send(frame, { type: 'intent-i1:ready' }, 'https://evil.example.com')
    expect(postMessage).not.toHaveBeenCalled()
    send(frame, { type: 'intent-i1:ready' })
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: true }),
      PICKER
    )
    expect(postMessage.mock.calls[0]?.[0]).not.toHaveProperty(
      'displayCloseButton'
    )
    send(frame, { type: 'intent-i1:readyToUse' })
    expect(screen.queryByRole('status')).toBe(null)
    await waitFor(() => {
      expect(frame).toHaveFocus()
    })
  })

  it('leaves the close button to Drive once it is ready, unless it asks for it', async () => {
    renderButton()
    const frame = await openPicker()
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible()

    send(frame, { type: 'intent-i1:ready' })
    send(frame, { type: 'intent-i1:readyToUse' })
    expect(screen.queryByRole('button', { name: 'Close' })).toBe(null)

    send(frame, { type: 'intent-i1:showCross' })
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible()
    send(frame, { type: 'intent-i1:hideCross' })
    expect(screen.queryByRole('button', { name: 'Close' })).toBe(null)

    send(frame, {
      type: 'intent-i1:resize',
      dimensions: { width: 640, height: 480 }
    })
    expect(screen.getByRole('dialog', { name: 'Twake Drive' })).toHaveStyle({
      width: '640px',
      height: '480px'
    })
  })

  it('stops listening and drops the frame on close and on unmount', async () => {
    const addListener = jest.spyOn(window, 'addEventListener')
    const removeListener = jest.spyOn(window, 'removeEventListener')
    const { onLinks, unmount } = renderButton()
    const pick = {
      type: 'intent-i1:done',
      document: [
        { id: 'f1', name: 'plan.pdf', sharingLink: `${PICKER}/public?s=x` }
      ]
    }
    const listeners = (): unknown[] =>
      addListener.mock.calls
        .filter(([type]) => type === 'message')
        .map(([, listener]) => listener)
    const removed = (listener: unknown): boolean =>
      removeListener.mock.calls.some(
        ([type, candidate]) => type === 'message' && candidate === listener
      )

    // Closed by the user: the listener goes with the frame
    let frame = await openPicker()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
    expect(frame).not.toBeInTheDocument()
    expect(listeners()).toHaveLength(1)
    expect(removed(listeners()[0])).toBe(true)
    send(frame, pick)
    expect(onLinks).not.toHaveBeenCalled()

    // Unmounted while open (the composer closes)
    frame = await openPicker()
    expect(listeners()).toHaveLength(2)
    unmount()
    expect(frame).not.toBeInTheDocument()
    expect(removed(listeners()[1])).toBe(true)
    send(frame, pick)
    expect(onLinks).not.toHaveBeenCalled()
    addListener.mockRestore()
    removeListener.mockRestore()
  })

  it('gives the files shared by link and closes', async () => {
    const { onLinks } = renderButton()
    const frame = await openPicker()
    send(frame, { type: 'intent-i1:ready' })
    send(frame, {
      type: 'intent-i1:done',
      document: [
        {
          id: 'f1',
          name: 'plan.pdf',
          sharingLink: `${PICKER}/public?sharecode=x`
        }
      ]
    })

    expect(onLinks).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'plan.pdf',
        sharingLink: `${PICKER}/public?sharecode=x`
      })
    ])
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBe(null)
    })
  })

  it('downloads the files to attach', async () => {
    const { onAttach } = renderButton()
    const frame = await openPicker()
    send(frame, { type: 'intent-i1:ready' })
    send(frame, {
      type: 'intent-i1:done',
      document: [
        {
          id: 'f2',
          name: 'notes.txt',
          size: 5,
          mimeType: 'text/plain',
          downloadLink: `${DRIVE}/files/downloads/s3cr3t/notes.txt`
        }
      ]
    })

    await waitFor(() => {
      expect(onAttach).toHaveBeenCalledTimes(1)
    })
    const [files] = onAttach.mock.calls[0] as [File[]]
    expect(files.map(file => [file.name, file.type, file.size])).toEqual([
      ['notes.txt', 'text/plain', 5]
    ])
  })

  it('says when Drive cannot be opened, and tries again', async () => {
    refusesExchange = true
    renderButton()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Attach from Drive' })
    )

    expect(
      await screen.findByText('Twake Drive could not be opened.')
    ).toBeVisible()
    // Refused again after renewing the session: the exchange was tried twice
    expect(
      fetchMock.mock.calls.filter(([url]) =>
        urlOf(url).endsWith('/auth/token_exchange')
      )
    ).toHaveLength(2)
    refusesExchange = false
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTitle('Twake Drive file picker')).toBeVisible()
  })

  it('is not offered without TDRIVE_ENABLED, and calls no Drive', async () => {
    renderButton(false)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Attach from Drive' })).toBe(
        null
      )
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('hears the picker when its dialog shows on the overlay of TwakeSpace', async () => {
    // Another document, as the overlay frame TwakeSpace puts over its page
    const host = document.createElement('iframe')
    document.body.append(host)
    const overlayWindow = host.contentWindow
    const overlayBody = host.contentDocument?.body
    if (!overlayWindow || !overlayBody) throw new Error('No overlay document')
    const { unmount } = renderButton(true, {
      getStatus: () => 'connected',
      getBody: () => overlayBody,
      subscribe: () => () => undefined
    })

    await userEvent.click(
      await screen.findByRole('button', { name: 'Attach from Drive' })
    )
    const frame = await within(overlayBody).findByTitle(
      'Twake Drive file picker'
    )
    // SAFETY: found by its title, the iframe of the picker
    const picker = (frame as HTMLIFrameElement).contentWindow
    if (picker === null) throw new Error('No window in the frame')
    const postMessage = jest.spyOn(picker, 'postMessage')

    // The picker posts to its parent: the overlay's window
    act(() => {
      overlayWindow.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'intent-i1:ready' },
          origin: PICKER,
          source: picker
        })
      )
    })

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: true }),
      PICKER
    )
    unmount()
    host.remove()
  })
})
