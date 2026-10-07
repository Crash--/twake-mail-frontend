import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EmailBodyPart } from 'jmap-client-ts'

import {
  makeBodyPart,
  makeFakeJmapServer
} from '@common/testing/fakeJmapServer'
import { readObjectUrl } from '@common/testing/objectUrls'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { AttachmentList } from './AttachmentList'

const DOWNLOAD_ALL = 'com:linagora:params:downloadAll'
const ZIP_BYTES = new Uint8Array([0x50, 0x4b, 0x05, 0x06])

function part(
  overrides: Partial<EmailBodyPart> & Pick<EmailBodyPart, 'type'>
): EmailBodyPart {
  return makeBodyPart({ disposition: 'attachment', ...overrides })
}

function renderList(
  attachments: EmailBodyPart[],
  blobs: Record<string, string> = {},
  capabilities?: Record<string, unknown>,
  emailId = 'e1'
): ReturnType<typeof renderWithProviders> {
  const server = makeFakeJmapServer({ capabilities })
  for (const [id, content] of Object.entries(blobs))
    server.blobs.set(id, content)
  return renderWithProviders(
    <AttachmentList attachments={attachments} emailId={emailId} />,
    { withJmapSession: true, jmapServer: server }
  )
}

describe('AttachmentList', () => {
  it('renders nothing without attachments', async () => {
    renderList([])
    await waitFor(() => {
      expect(screen.queryByTestId('attachment-list')).toBeNull()
    })
  })

  it('shows the count and the total size', async () => {
    renderList([
      part({
        blobId: 'b1',
        name: 'a.zip',
        type: 'application/zip',
        size: 1000
      }),
      part({ blobId: 'b2', name: 'b.zip', type: 'application/zip', size: 2000 })
    ])
    expect(await screen.findByText('2 Attachments (3 kB)')).toBeVisible()
  })

  it('previews an image in an img of a known image type, and revokes its URL', async () => {
    const revoke = jest.spyOn(URL, 'revokeObjectURL')
    renderList(
      [part({ blobId: 'b1', name: 'p.png', type: 'image/png', size: 4 })],
      { b1: 'PNG!' }
    )

    await userEvent.click(
      await screen.findByRole('button', { name: /^Preview p.png/ })
    )
    const image = await screen.findByTestId('attachment-preview-image')
    expect(image.tagName).toBe('IMG')
    expect(image).toHaveAttribute('alt', 'p.png')
    const url = image.getAttribute('src') ?? ''
    expect(url).toMatch(/^blob:/)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(revoke).toHaveBeenCalledWith(url)
    })
  })

  it('shows an SVG as an image, never as a document', async () => {
    renderList(
      [part({ blobId: 'b1', name: 'x.svg', type: 'image/svg+xml', size: 40 })],
      {
        b1: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
      }
    )
    await userEvent.click(
      await screen.findByRole('button', { name: /^Preview x.svg/ })
    )
    const image = await screen.findByTestId('attachment-preview-image')
    expect(image.tagName).toBe('IMG')
    expect(document.querySelector('iframe, object, embed')).toBeNull()
    expect(document.querySelector('script')).toBeNull()
  })

  it('shows text escaped', async () => {
    renderList(
      [part({ blobId: 'b1', name: 'n.txt', type: 'text/plain', size: 30 })],
      { b1: '<img src=x onerror=alert(1)> hello' }
    )
    await userEvent.click(
      await screen.findByRole('button', { name: /^Preview n.txt/ })
    )
    const text = await screen.findByTestId('attachment-preview-text')
    expect(text).toHaveTextContent('<img src=x onerror=alert(1)> hello')
    expect(within(text).queryByRole('img')).toBeNull()
  })

  it('shows an HTML file through the sanitizer, the CSP and the sandboxed frame of the email body', async () => {
    renderList(
      [part({ blobId: 'b1', name: 'page.html', type: 'text/html', size: 200 })],
      {
        b1: '<p onclick="steal()">Hi</p><script>steal()</script><meta http-equiv="refresh" content="0;url=https://evil.example"><iframe src="https://evil.example"></iframe><a href="javascript:steal()">x</a><img src="https://tracker.example/p.gif">'
      }
    )
    await userEvent.click(
      await screen.findByRole('button', { name: /^Preview page.html/ })
    )
    const frame = await screen.findByTitle('Message content')
    expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts')
    await waitFor(() => {
      expect(frame).toHaveAttribute('src')
    })
    const html = (await readObjectUrl(frame.getAttribute('src') ?? '')) ?? ''
    expect(html).toContain('Hi')
    expect(html).toContain("default-src 'none'")
    expect(html).not.toMatch(
      /<script|<iframe|<meta http-equiv="refresh"|onclick|javascript:|tracker\.example/i
    )
  })

  it('downloads a file that cannot be previewed, from its card', async () => {
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    renderList(
      [part({ blobId: 'b1', name: 'a.zip', type: 'application/zip', size: 2 })],
      { b1: 'PK' }
    )
    await userEvent.click(
      await screen.findByRole('button', { name: /^Download a.zip \(/ })
    )
    await waitFor(() => {
      expect(click).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows three cards, then the others with "+N more", and hides them again', async () => {
    renderList(
      Array.from({ length: 5 }, (_unused, index) =>
        part({
          blobId: `b${index}`,
          name: `f${index}.zip`,
          type: 'application/zip',
          size: 1
        })
      )
    )
    expect(await screen.findAllByTestId('attachment-item')).toHaveLength(3)
    await userEvent.click(screen.getByTestId('attachment-show-more'))
    expect(screen.getAllByTestId('attachment-item')).toHaveLength(5)
    await userEvent.click(screen.getByTestId('attachment-show-less'))
    expect(screen.getAllByTestId('attachment-item')).toHaveLength(3)
  })

  describe('download all', () => {
    const attachments = [
      part({ blobId: 'b1', name: 'a.zip', type: 'application/zip', size: 1 }),
      part({ blobId: 'b2', name: 'b.zip', type: 'application/zip', size: 1 })
    ]
    const endpoint =
      'https://jmap.example.com/downloadAll/{accountId}/{emailId}?name={name}'

    it('is offered with the capability and several attachments', async () => {
      renderList(attachments, {}, { [DOWNLOAD_ALL]: { endpoint } })
      expect(
        await screen.findByRole('button', { name: 'Download all' })
      ).toBeVisible()
    })

    it.each([
      ['no capability', undefined],
      ['no endpoint', { [DOWNLOAD_ALL]: {} }]
    ])('is hidden with %s', async (_label, capabilities) => {
      renderList(attachments, {}, capabilities)
      await screen.findAllByTestId('attachment-item')
      expect(screen.queryByRole('button', { name: 'Download all' })).toBeNull()
    })

    it('is hidden with a single attachment', async () => {
      renderList(attachments.slice(0, 1), {}, { [DOWNLOAD_ALL]: { endpoint } })
      await screen.findAllByTestId('attachment-item')
      expect(screen.queryByRole('button', { name: 'Download all' })).toBeNull()
    })

    it('fetches the archive with the authorization and saves it as a zip', async () => {
      const click = jest
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined)
      const fetchSpy = jest.fn(
        (_url: string, _init?: RequestInit): Promise<Response> =>
          Promise.resolve(new Response(ZIP_BYTES, { status: 200 }))
      )
      Object.assign(globalThis, { fetch: fetchSpy })
      renderList(attachments, {}, { [DOWNLOAD_ALL]: { endpoint } })
      await userEvent.click(
        await screen.findByRole('button', { name: 'Download all' })
      )
      await waitFor(() => {
        expect(click).toHaveBeenCalledTimes(1)
      })
      const [url, init] = fetchSpy.mock.calls[0] ?? []
      expect(String(url)).toMatch(
        /^https:\/\/jmap\.example\.com\/downloadAll\/[^/]+\/e1\?name=TwakeMail-/
      )
      expect(init?.headers).toMatchObject({ Authorization: expect.any(String) })
    })

    it('reports an error instead of saving a page that is not an archive', async () => {
      const click = jest
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined)
      jest.spyOn(console, 'error').mockImplementation(() => undefined)
      Object.assign(globalThis, {
        fetch: (): Promise<Response> =>
          Promise.resolve(
            new Response('<!doctype html><html></html>', {
              status: 200,
              headers: { 'Content-Type': 'text/html' }
            })
          )
      })
      renderList(attachments, {}, { [DOWNLOAD_ALL]: { endpoint } })
      await userEvent.click(
        await screen.findByRole('button', { name: 'Download all' })
      )
      expect(await screen.findByTestId('toast')).toHaveTextContent(
        'Attachment download failed'
      )
      expect(click).not.toHaveBeenCalled()
    })
  })
})
