import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'

import { renderDs } from '@/ds/testing/renderDs'

import { PdfLinkArea, PdfPageFrame, PdfTextLayer } from './PdfPageLayers'

describe('PdfPageLayers', () => {
  it('places a named link over its area of the page, opening in a new tab', async () => {
    // jsdom does not navigate
    const onClick = jest.fn((event: { preventDefault: () => void }) => {
      event.preventDefault()
    })
    renderDs(
      <PdfPageFrame>
        <PdfLinkArea
          href="https://example.com/"
          label="https://example.com/"
          left={0.1}
          top={0.25}
          width={0.5}
          height={0.125}
          onClick={onClick}
        />
      </PdfPageFrame>
    )

    const link = screen.getByRole('link', { name: 'https://example.com/' })
    expect(link).toHaveAttribute('href', 'https://example.com/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveStyle({
      position: 'absolute',
      left: '10%',
      top: '25%',
      width: '50%',
      height: '12.5%'
    })
    await userEvent.click(link)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('gives the text layer container to pdf.js', () => {
    const ref = createRef<HTMLDivElement>()
    renderDs(
      <PdfPageFrame>
        <PdfTextLayer ref={ref} />
      </PdfPageFrame>
    )

    expect(ref.current).toHaveStyle({ position: 'absolute' })
  })
})
