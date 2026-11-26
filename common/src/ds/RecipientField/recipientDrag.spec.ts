/**
 * @jest-environment jsdom
 */
import { endRecipientDrag, startRecipientDrag } from './recipientDrag'

describe('startRecipientDrag', () => {
  afterEach(() => {
    endRecipientDrag()
    document.body.innerHTML = ''
  })

  it('draws the dragged chip in its own document, another frame included', () => {
    // In TwakeSpace the composer is on an overlay: another document, whose
    // elements are not instances of this window's HTMLElement
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const frameDocument = frame.contentDocument
    if (frameDocument === null) throw new Error('No document in the frame')
    const chip = frameDocument.createElement('span')
    chip.textContent = 'Alice Martin'
    frameDocument.body.append(chip)
    const setDragImage = jest.fn()
    const event = {
      currentTarget: chip,
      dataTransfer: {
        setData: jest.fn(),
        setDragImage,
        effectAllowed: 'none' as DataTransfer['effectAllowed']
      }
    }

    startRecipientDrag(event, { group: 'to', field: 'to', id: 'alice' })

    expect(setDragImage).toHaveBeenCalledTimes(1)
    const [ghost] = setDragImage.mock.calls[0] as [HTMLElement]
    expect(ghost.ownerDocument).toBe(frameDocument)
    expect(ghost.getAttribute('aria-hidden')).toBe('true')
  })
})
