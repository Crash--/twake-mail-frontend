import { forwardEscapeKey, interceptMailtoLinks } from './EmailBodyFrame'

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
