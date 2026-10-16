import {
  forwardEscapeKey,
  interceptAnchorLinks,
  interceptMailtoLinks
} from './EmailBodyFrame'

function frameDocument(html: string): Document {
  const document = new DOMParser().parseFromString(html, 'text/html')
  return document
}

describe('interceptMailtoLinks', () => {
  it('hands mailto links to the app instead of following them', () => {
    const document = frameDocument(
      '<a href=" MAILTO:bob@example.com?subject=Hi">bob</a>'
    )
    const onMailtoLink = jest.fn()
    interceptMailtoLinks(document, onMailtoLink)
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })

    document.querySelector('a')?.dispatchEvent(event)

    expect(onMailtoLink).toHaveBeenCalledWith(
      'MAILTO:bob@example.com?subject=Hi'
    )
    expect(event.defaultPrevented).toBe(true)
  })

  it('lets the other links open in their tab', () => {
    const document = frameDocument('<a href="https://example.com">site</a>')
    const onMailtoLink = jest.fn()
    interceptMailtoLinks(document, onMailtoLink)
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })

    document.querySelector('a')?.dispatchEvent(event)

    expect(onMailtoLink).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })
})

describe('interceptAnchorLinks (tf#4796)', () => {
  function click(document: Document, selector: string): MouseEvent {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    document.querySelector(selector)?.dispatchEvent(event)
    return event
  }

  it('scrolls to the element of id x or the <a name="x"> instead of opening a new tab', () => {
    const document = frameDocument(
      '<a id="toc" href="#part-2" target="_blank">Part 2</a><a id="by-name" href="#legacy" target="_blank">Legacy</a><a id="not-a-link" href="#other" target="_blank">Other</a><h2 id="part-2">Part 2</h2><p name="legacy"></p><a name="legacy"></a><span name="other"></span>'
    )
    const scrolled: Element[] = []
    jest
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(function (this: Element) {
        scrolled.push(this)
      })
    interceptAnchorLinks(document)

    expect(click(document, '#toc').defaultPrevented).toBe(true)
    expect(click(document, '#by-name').defaultPrevented).toBe(true)
    // Only a link names an anchor
    expect(click(document, '#not-a-link').defaultPrevented).toBe(true)
    expect(scrolled).toEqual([
      document.getElementById('part-2'),
      document.querySelector('a[name="legacy"]')
    ])
  })

  it('keeps the middle button from opening the anchor in a new tab', () => {
    const document = frameDocument(
      '<a href="#part-2" target="_blank">Part 2</a><a href="https://example.com/">site</a><h2 id="part-2">Part 2</h2>'
    )
    interceptAnchorLinks(document)
    const middleClick = (link: Element | undefined): MouseEvent => {
      const event = new MouseEvent('auxclick', {
        button: 1,
        bubbles: true,
        cancelable: true
      })
      link?.dispatchEvent(event)
      return event
    }
    const [anchor, site] = Array.from(document.querySelectorAll('a'))

    expect(middleClick(anchor).defaultPrevented).toBe(true)
    expect(middleClick(site).defaultPrevented).toBe(false)
  })

  it('lets the other links open in their tab', () => {
    const document = frameDocument(
      '<a href="https://example.com/#part" target="_blank">site</a>'
    )
    interceptAnchorLinks(document)

    expect(click(document, 'a').defaultPrevented).toBe(false)
  })
})

describe('forwardEscapeKey', () => {
  function pressIn(document: Document, key: string): jest.Mock {
    const frame = window.document.createElement('iframe')
    window.document.body.append(frame)
    const heard = jest.fn()
    window.document.addEventListener('keydown', heard)
    forwardEscapeKey(document, frame)

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true })
    )

    window.document.removeEventListener('keydown', heard)
    frame.remove()
    return heard
  }

  it('presses Escape again on the frame, for the shortcuts of the app', () => {
    const heard = pressIn(frameDocument('<p>Hello</p>'), 'Escape')

    expect(heard).toHaveBeenCalledTimes(1)
    expect(heard).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'Escape' })
    )
  })

  it('keeps the other keys in the frame', () => {
    const heard = pressIn(frameDocument('<p>Hello</p>'), 'j')

    expect(heard).not.toHaveBeenCalled()
  })
})
