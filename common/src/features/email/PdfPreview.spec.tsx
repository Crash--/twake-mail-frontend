import { act, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { PdfPreview } from './PdfPreview'
import { loadPdf } from './pdfjs'

// pdf.js is ESM with `import.meta`: Jest does not load it
jest.mock('./pdfjs', () => ({ loadPdf: jest.fn() }))

const mockedLoadPdf = jest.mocked(loadPdf)

interface Observer {
  callback: IntersectionObserverCallback
  targets: Element[]
}
const observers: Observer[] = []

/** Reports `target` as scrolled into (or out of) view */
function intersect(target: Element, isIntersecting: boolean): void {
  for (const observer of observers) {
    if (!observer.targets.includes(target)) continue
    act(() => {
      observer.callback(
        // SAFETY: the one field the component reads
        [{ target, isIntersecting } as IntersectionObserverEntry],
        new FakeIntersectionObserver(() => undefined)
      )
    })
  }
}

function makePdf(numPages: number, getPage: jest.Mock): unknown {
  return { numPages, getPage }
}

class FakeIntersectionObserver implements IntersectionObserver {
  readonly root = null
  readonly rootMargin = ''
  readonly scrollMargin = ''
  readonly thresholds = []
  private readonly entry: Observer

  constructor(callback: IntersectionObserverCallback) {
    this.entry = { callback, targets: [] }
    observers.push(this.entry)
  }

  observe(target: Element): void {
    this.entry.targets.push(target)
  }

  disconnect(): void {
    this.entry.targets.length = 0
  }

  unobserve(target: Element): void {
    this.entry.targets = this.entry.targets.filter(item => item !== target)
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

beforeEach(() => {
  observers.length = 0
  window.IntersectionObserver = FakeIntersectionObserver
})

describe('PdfPreview', () => {
  it('names a canvas per page, draws none before it is in view, and terminates the worker on unmount', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined)
    const getPage = jest
      .fn()
      .mockResolvedValue({ getViewport: () => ({ width: 100, height: 100 }) })
    mockedLoadPdf.mockReturnValue({
      promise: Promise.resolve({ pdf: makePdf(3, getPage) as never }),
      destroy
    })
    const { unmount } = renderWithProviders(
      <PdfPreview bytes={new Uint8Array([1])} onError={jest.fn()} />
    )

    expect(
      await screen.findByRole('img', { name: 'Page 1 of 3' })
    ).toBeVisible()
    expect(screen.getByRole('img', { name: 'Page 3 of 3' })).toBeVisible()
    // Only the first page was read, for the size of the placeholders
    expect(getPage).toHaveBeenCalledTimes(1)
    expect(getPage).toHaveBeenCalledWith(1)
    unmount()
    expect(destroy).toHaveBeenCalled()
  })

  it('reads a page only when it scrolls into view', async () => {
    const getPage = jest
      .fn()
      .mockResolvedValue({ getViewport: () => ({ width: 100, height: 100 }) })
    mockedLoadPdf.mockReturnValue({
      promise: Promise.resolve({ pdf: makePdf(50, getPage) as never }),
      destroy: jest.fn().mockResolvedValue(undefined)
    })
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    renderWithProviders(
      <PdfPreview bytes={new Uint8Array([1])} onError={jest.fn()} />
    )
    const canvas = await screen.findByRole('img', { name: 'Page 7 of 50' })
    expect(getPage).toHaveBeenCalledTimes(1)
    intersect(canvas, true)
    await waitFor(() => {
      expect(getPage).toHaveBeenCalledWith(7)
    })
    expect(getPage).toHaveBeenCalledTimes(2)
  })

  it('terminates the worker when closed while the document is loading', () => {
    const destroy = jest.fn().mockResolvedValue(undefined)
    mockedLoadPdf.mockReturnValue({
      promise: new Promise(() => undefined),
      destroy
    })
    const { unmount } = renderWithProviders(
      <PdfPreview bytes={new Uint8Array([1])} onError={jest.fn()} />
    )
    unmount()
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('reports a document pdf.js cannot read', async () => {
    mockedLoadPdf.mockReturnValue({
      promise: Promise.reject(new Error('Invalid PDF structure')),
      destroy: jest.fn().mockResolvedValue(undefined)
    })
    const onError = jest.fn()
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    renderWithProviders(
      <PdfPreview bytes={new Uint8Array([1])} onError={onError} />
    )
    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1)
    })
  })
})
