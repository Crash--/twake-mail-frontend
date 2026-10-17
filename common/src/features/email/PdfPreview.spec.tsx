import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { PdfPreview } from './PdfPreview'
import { loadPdf, renderTextLayer } from './pdfjs'

// pdf.js is ESM with `import.meta`: Jest does not load it
jest.mock('./pdfjs', () => ({ loadPdf: jest.fn(), renderTextLayer: jest.fn() }))

const mockedLoadPdf = jest.mocked(loadPdf)
const mockedRenderTextLayer = jest.mocked(renderTextLayer)

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
  mockedRenderTextLayer.mockReset()
})

/** A page of 200 x 100 that draws, with `annotations` */
function makeDrawablePage(annotations: unknown[]): unknown {
  return {
    getViewport: ({ scale }: { scale: number }) => ({
      width: 200 * scale,
      height: 100 * scale,
      scale,
      convertToViewportPoint: (x: number, y: number) => [
        x * scale,
        (100 - y) * scale
      ]
    }),
    render: () => ({ promise: Promise.resolve(), cancel: jest.fn() }),
    getAnnotations: jest.fn().mockResolvedValue(annotations)
  }
}

/** Opens a one page document whose page is drawn, and scrolls it into view */
async function renderDrawnPage(
  annotations: unknown[],
  props: { onMailtoLink?: (href: string) => void } = {}
): Promise<HTMLElement> {
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    // SAFETY: pdf.js is faked, it never draws on it
    .mockReturnValue({} as CanvasRenderingContext2D)
  mockedRenderTextLayer.mockImplementation((_page, _viewport, container) => {
    const run = container.ownerDocument.createElement('span')
    run.textContent = 'Quarterly report'
    container.append(run)
    return { promise: Promise.resolve(), cancel: jest.fn() }
  })
  const getPage = jest.fn().mockResolvedValue(makeDrawablePage(annotations))
  mockedLoadPdf.mockReturnValue({
    promise: Promise.resolve({ pdf: makePdf(1, getPage) as never }),
    destroy: jest.fn().mockResolvedValue(undefined)
  })
  renderWithProviders(
    <PdfPreview
      bytes={new Uint8Array([1])}
      onError={jest.fn()}
      onMailtoLink={props.onMailtoLink ?? jest.fn()}
    />
  )
  const canvas = await screen.findByRole('img', { name: 'Page 1 of 1' })
  intersect(canvas, true)
  await waitFor(() => {
    expect(canvas).toHaveAttribute('data-rendered', 'true')
  })
  return canvas
}

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
      <PdfPreview
        bytes={new Uint8Array([1])}
        onError={jest.fn()}
        onMailtoLink={jest.fn()}
      />
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
      <PdfPreview
        bytes={new Uint8Array([1])}
        onError={jest.fn()}
        onMailtoLink={jest.fn()}
      />
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
      <PdfPreview
        bytes={new Uint8Array([1])}
        onError={jest.fn()}
        onMailtoLink={jest.fn()}
      />
    )
    unmount()
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('asks the password of an encrypted document, again while it is wrong', async () => {
    const getPage = jest
      .fn()
      .mockResolvedValue({ getViewport: () => ({ width: 100, height: 100 }) })
    const answers: (string | null)[] = []
    mockedLoadPdf.mockImplementation((_data, requestPassword) => ({
      promise: (async () => {
        answers.push(await requestPassword(false))
        answers.push(await requestPassword(true))
        return { pdf: makePdf(1, getPage) as never }
      })(),
      destroy: jest.fn().mockResolvedValue(undefined)
    }))
    const user = userEvent.setup()
    renderWithProviders(
      <PdfPreview
        bytes={new Uint8Array([1])}
        onError={jest.fn()}
        onMailtoLink={jest.fn()}
      />
    )

    const form = await screen.findByRole('form', {
      name: 'This PDF is protected by a password'
    })
    expect(form).toBeVisible()
    const field = screen.getByLabelText('Password')
    expect(field).toHaveFocus()
    expect(field).not.toHaveAttribute('aria-invalid', 'true')
    await user.type(field, 'wrong')
    await user.keyboard('{Enter}')

    expect(
      await screen.findByText('Incorrect password, try again.')
    ).toBeVisible()
    const retryField = screen.getByLabelText('Password')
    expect(retryField).toHaveAttribute('aria-invalid', 'true')
    await user.type(retryField, 'secret')
    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(
      await screen.findByRole('img', { name: 'Page 1 of 1' })
    ).toBeVisible()
    expect(answers).toEqual(['wrong', 'secret'])
    expect(screen.queryByTestId('pdf-password-form')).toBe(null)
  })

  it('gives up the password and terminates the worker when closed while asking it', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined)
    let answer: Promise<string | null> | null = null
    mockedLoadPdf.mockImplementation((_data, requestPassword) => {
      answer = requestPassword(false)
      return { promise: new Promise(() => undefined), destroy }
    })
    const { unmount } = renderWithProviders(
      <PdfPreview
        bytes={new Uint8Array([1])}
        onError={jest.fn()}
        onMailtoLink={jest.fn()}
      />
    )
    expect(await screen.findByTestId('pdf-password-form')).toBeVisible()

    unmount()

    expect(destroy).toHaveBeenCalledTimes(1)
    await expect(answer).resolves.toBe(null)
  })

  it('reports a document pdf.js cannot read', async () => {
    mockedLoadPdf.mockReturnValue({
      promise: Promise.reject(new Error('Invalid PDF structure')),
      destroy: jest.fn().mockResolvedValue(undefined)
    })
    const onError = jest.fn()
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    renderWithProviders(
      <PdfPreview
        bytes={new Uint8Array([1])}
        onError={onError}
        onMailtoLink={jest.fn()}
      />
    )
    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1)
    })
  })

  it('lays the text of a drawn page over it, and its web links only', async () => {
    await renderDrawnPage([
      {
        subtype: 'Link',
        url: 'https://example.com/report',
        rect: [0, 0, 100, 50]
      },
      { subtype: 'Link', url: 'javascript:alert(1)', rect: [0, 0, 200, 100] },
      { subtype: 'Link', dest: 'chapter-2', rect: [0, 0, 200, 100] }
    ])

    expect(screen.getByText('Quarterly report')).toBeInTheDocument()
    expect(mockedRenderTextLayer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 900 }),
      expect.any(HTMLElement)
    )
    const link = await screen.findByRole('link', {
      name: 'https://example.com/report'
    })
    expect(link).toHaveAttribute('href', 'https://example.com/report')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getAllByTestId('pdf-preview-link')).toHaveLength(1)
  })

  it('writes to the address of a mailto: link in the composer', async () => {
    const onMailtoLink = jest.fn()
    const user = userEvent.setup()
    await renderDrawnPage(
      [
        {
          subtype: 'Link',
          url: 'mailto:bob@example.com',
          rect: [0, 0, 100, 50]
        }
      ],
      { onMailtoLink }
    )

    await user.click(
      await screen.findByRole('link', { name: 'mailto:bob@example.com' })
    )

    expect(onMailtoLink).toHaveBeenCalledWith('mailto:bob@example.com')
  })

  it('releases the text and the links of a page scrolled out of view', async () => {
    const canvas = await renderDrawnPage([
      { subtype: 'Link', url: 'https://example.com/', rect: [0, 0, 100, 50] }
    ])
    expect(
      await screen.findByRole('link', { name: 'https://example.com/' })
    ).toBeVisible()

    intersect(canvas, false)

    expect(screen.queryByRole('link')).toBe(null)
    expect(screen.queryByText('Quarterly report')).toBe(null)
  })

  it('gives the open document, and null again once closed', async () => {
    const getPage = jest
      .fn()
      .mockResolvedValue({ getViewport: () => ({ width: 100, height: 100 }) })
    const pdf = makePdf(2, getPage)
    mockedLoadPdf.mockReturnValue({
      promise: Promise.resolve({ pdf: pdf as never }),
      destroy: jest.fn().mockResolvedValue(undefined)
    })
    const onOpened = jest.fn()
    const { unmount } = renderWithProviders(
      <PdfPreview
        bytes={new Uint8Array([1])}
        onError={jest.fn()}
        onMailtoLink={jest.fn()}
        onOpened={onOpened}
      />
    )
    await waitFor(() => {
      expect(onOpened).toHaveBeenCalledWith(pdf)
    })
    unmount()
    expect(onOpened).toHaveBeenLastCalledWith(null)
  })
})
