import { interceptMailtoLinks } from './EmailBodyFrame'

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
