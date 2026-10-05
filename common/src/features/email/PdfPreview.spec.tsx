import { screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '@common/testing/renderWithProviders'

import { PdfPreview } from './PdfPreview'
import { loadPdf } from './pdfjs'

// pdf.js is ESM with `import.meta`: Jest does not load it
jest.mock('./pdfjs', () => ({
  ANNOTATIONS_DISABLED: 0,
  loadPdf: jest.fn()
}))

const mockedLoadPdf = jest.mocked(loadPdf)

describe('PdfPreview', () => {
  it('draws a named canvas per page, and destroys the document on unmount', async () => {
    const destroy = jest.fn().mockResolvedValue(undefined)
    mockedLoadPdf.mockResolvedValue({
      // SAFETY: the part of the document the component reads
      pdf: {
        numPages: 2,
        getPage: jest.fn().mockRejectedValue(new Error('not drawn'))
      } as never,
      destroy
    })
    const onError = jest.fn()
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { unmount } = renderWithProviders(
      <PdfPreview bytes={new Uint8Array([1])} onError={onError} />
    )

    expect(
      await screen.findByRole('img', { name: 'Page 1 of 2' })
    ).toBeVisible()
    expect(screen.getByRole('img', { name: 'Page 2 of 2' })).toBeVisible()
    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
    unmount()
    expect(destroy).toHaveBeenCalled()
  })

  it('reports a document pdf.js cannot read', async () => {
    mockedLoadPdf.mockRejectedValue(new Error('Invalid PDF structure'))
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
