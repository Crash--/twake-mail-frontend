import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  makeBodyPart,
  makeFakeJmapServer
} from '@common/testing/fakeJmapServer'
import { renderWithProviders } from '@common/testing/renderWithProviders'

import { AttachmentPreviewDialog } from './AttachmentPreviewDialog'
import { loadPdf } from './pdfjs'

// pdf.js is ESM with `import.meta`: Jest does not load it
jest.mock('./pdfjs', () => ({ loadPdf: jest.fn(), renderTextLayer: jest.fn() }))

const mockedLoadPdf = jest.mocked(loadPdf)

/** No page scrolls into view in these tests */
class IdleIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly scrollMargin = ''
  readonly thresholds = []
  readonly observe = jest.fn()
  readonly disconnect = jest.fn()
  readonly unobserve = jest.fn()
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

beforeEach(() => {
  window.IntersectionObserver = IdleIntersectionObserver
})

function renderPdf(numPages: number): jest.Mock {
  const getPage = jest.fn().mockResolvedValue({
    getViewport: ({ scale }: { scale: number }) => ({
      width: 100 * scale,
      height: 100 * scale
    }),
    render: () => ({ promise: Promise.resolve() })
  })
  mockedLoadPdf.mockReturnValue({
    promise: Promise.resolve({ pdf: { numPages, getPage } as never }),
    destroy: jest.fn().mockResolvedValue(undefined)
  })
  const server = makeFakeJmapServer()
  server.blobs.set('b1', '%PDF-1.4')
  renderWithProviders(
    <AttachmentPreviewDialog
      part={makeBodyPart({
        blobId: 'b1',
        name: 'report.pdf',
        type: 'application/pdf',
        size: 8
      })}
      kind="pdf"
      onClose={jest.fn()}
    />,
    { withJmapSession: true, jmapServer: server }
  )
  return getPage
}

describe('AttachmentPreviewDialog', () => {
  it('prints a PDF once it is open, from the bar', async () => {
    const getPage = renderPdf(2)
    const print = await screen.findByRole('button', { name: 'Print' })
    expect(print).toHaveAttribute('data-testid', 'attachment-preview-print')
    jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      // SAFETY: pdf.js is faked, it never draws on it
      .mockReturnValue({} as CanvasRenderingContext2D)
    jest
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation(callback => {
        callback(new Blob(['png'], { type: 'image/png' }))
      })
    // jsdom cannot print
    jest.spyOn(console, 'error').mockImplementation(() => undefined)

    await userEvent.click(print)

    // The toast, and its live region
    expect(await screen.findAllByText('Printing in progress')).not.toEqual([])
    // Each page is drawn again, for the print frame
    expect(await screen.findByTestId('print-frame')).toBeInTheDocument()
    expect(getPage).toHaveBeenCalledWith(2)
  })

  it('asks to download a PDF too long to be printed here', async () => {
    const getPage = renderPdf(201)

    await userEvent.click(await screen.findByRole('button', { name: 'Print' }))

    expect(
      await screen.findAllByText(
        'This PDF has more than 200 pages: download it to print it.'
      )
    ).not.toEqual([])
    expect(getPage).toHaveBeenCalledTimes(1)
  })
})
