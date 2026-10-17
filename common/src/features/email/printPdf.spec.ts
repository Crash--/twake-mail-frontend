/**
 * @jest-environment jsdom
 */
import { waitFor } from '@testing-library/react'

import { PRINT_SCALE } from './pdfLimits'
import { buildPdfPrintDocument, printPdf } from './printPdf'

const render = jest.fn()

interface FakePdf {
  numPages: number
  getPage: jest.Mock
}

function makePage(): unknown {
  return {
    getViewport: ({ scale }: { scale: number }) => ({
      width: 100 * scale,
      height: 200 * scale,
      scale
    }),
    render: (params: unknown) => {
      render(params)
      return { promise: Promise.resolve() }
    }
  }
}

function makePdf(numPages: number): FakePdf {
  return { numPages, getPage: jest.fn().mockResolvedValue(makePage()) }
}

let created = 0
const revoked: string[] = []

beforeEach(() => {
  created = 0
  revoked.length = 0
  render.mockClear()
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    // SAFETY: pdf.js is faked, it never draws on it
    .mockReturnValue({} as CanvasRenderingContext2D)
  jest
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation(callback => {
      callback(new Blob(['png'], { type: 'image/png' }))
    })
  URL.createObjectURL = jest.fn(() => {
    created += 1
    return `blob:page-${created}`
  })
  URL.revokeObjectURL = jest.fn((url: string) => {
    revoked.push(url)
  })
})

afterEach(() => {
  document.body.replaceChildren()
})

const options = {
  lang: 'en',
  title: 'report.pdf',
  pageLabel: (page: number, count: number): string => `Page ${page} of ${count}`
}

describe('buildPdfPrintDocument', () => {
  it('prints one escaped image per page, nothing able to run', () => {
    const html = buildPdfPrintDocument('fr', 'a<b>.pdf', [
      { url: 'blob:one', label: 'Page 1 of 2' },
      { url: 'blob:"two"', label: 'Page 2 of 2' }
    ])
    expect(html).toContain('<html lang="fr">')
    expect(html).toContain('<title>a&lt;b&gt;.pdf</title>')
    expect(html).toContain('<img src="blob:one" alt="Page 1 of 2">')
    expect(html).toContain('<img src="blob:&quot;two&quot;" alt="Page 2 of 2">')
    expect(html).toContain("default-src 'none'; img-src blob:;")
    expect(html).not.toContain('<script')
  })
})

describe('printPdf', () => {
  it('draws every page at the print resolution into the print frame', async () => {
    // jsdom cannot print
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    printPdf(makePdf(2) as never, {
      ...options,
      signal: new AbortController().signal
    }).catch(() => undefined)

    const frame = await waitFor(() => {
      const element = document.querySelector('[data-testid="print-frame"]')
      expect(element).not.toBe(null)
      return element
    })
    const html = frame?.getAttribute('srcdoc') ?? ''
    expect(html).toContain('<img src="blob:page-1" alt="Page 1 of 2">')
    expect(html).toContain('<img src="blob:page-2" alt="Page 2 of 2">')
    expect(render).toHaveBeenCalledTimes(2)
    // 150 dpi: a page of 100 units is 208 pixels wide
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        viewport: expect.objectContaining({
          width: Math.floor(100 * PRINT_SCALE)
        }) as unknown
      })
    )
  })

  it('prints nothing and releases the drawn pages once the preview is closed', async () => {
    const controller = new AbortController()
    const pdf = makePdf(3)
    pdf.getPage.mockImplementation((number: number) => {
      if (number === 2) controller.abort()
      return Promise.resolve(makePage())
    })

    await expect(
      printPdf(pdf as never, { ...options, signal: controller.signal })
    ).rejects.toThrow()

    expect(document.querySelector('[data-testid="print-frame"]')).toBe(null)
    expect(revoked).toEqual(['blob:page-1', 'blob:page-2'])
  })
})
