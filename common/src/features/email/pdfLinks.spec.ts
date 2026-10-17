import { findPdfLinks, type PdfLinkViewport } from './pdfLinks'

// A 200 x 100 page at scale 1: PDF y goes up, the viewport's goes down
const viewport: PdfLinkViewport = {
  width: 200,
  height: 100,
  convertToViewportPoint: (x, y) => [x, 100 - y]
}

function link(url: unknown, rect: unknown = [20, 50, 120, 75]): unknown {
  return { subtype: 'Link', url, rect }
}

describe('findPdfLinks', () => {
  it('places a web link in fractions of the page', () => {
    expect(findPdfLinks([link('https://example.com/a')], viewport)).toEqual([
      {
        url: 'https://example.com/a',
        left: 0.1,
        top: 0.25,
        width: 0.5,
        height: 0.25
      }
    ])
  })

  it('keeps http, https and mailto links only', () => {
    const links = findPdfLinks(
      [
        link('http://example.com/'),
        link('mailto:alice@example.com'),
        link('javascript:alert(1)'),
        link('file:///etc/passwd'),
        link('data:text/html,hi'),
        link('not a url'),
        link(undefined),
        { subtype: 'Link', dest: 'chapter-2', rect: [0, 0, 10, 10] },
        { subtype: 'Widget', url: 'https://example.com/', rect: [0, 0, 1, 1] }
      ],
      viewport
    )
    expect(links.map(item => item.url)).toEqual([
      'http://example.com/',
      'mailto:alice@example.com'
    ])
  })

  it('bounds a rectangle out of the page and drops an empty or broken one', () => {
    const links = findPdfLinks(
      [
        link('https://example.com/out', [-50, -50, 500, 500]),
        link('https://example.com/empty', [10, 10, 10, 50]),
        link('https://example.com/nan', [0, 0, Number.NaN, 10]),
        link('https://example.com/short', [0, 0, 10])
      ],
      viewport
    )
    expect(links).toEqual([
      {
        url: 'https://example.com/out',
        left: 0,
        top: 0,
        width: 1,
        height: 1
      }
    ])
  })

  it('finds nothing on a page without a size', () => {
    expect(
      findPdfLinks([link('https://example.com/')], { ...viewport, width: 0 })
    ).toEqual([])
  })
})
