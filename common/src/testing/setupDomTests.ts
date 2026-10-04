import '@testing-library/jest-dom'

import { TextDecoder, TextEncoder } from 'node:util'

import { installObjectUrls } from './objectUrls'

// jsdom lacks the encoding API that react-router uses
Object.assign(globalThis, { TextDecoder, TextEncoder })

// jsdom has no layout engine, hence no ResizeObserver, which MUI uses to
// measure some components
class ResizeObserverStub implements ResizeObserver {
  observe(): void {
    // nothing to measure without layout
  }
  unobserve(): void {
    // nothing to measure without layout
  }
  disconnect(): void {
    // nothing to measure without layout
  }
}

globalThis.ResizeObserver = ResizeObserverStub

// jsdom has no object URLs (email body frames, inline images)
installObjectUrls()

// jsdom has no layout either for ranges and points, which ProseMirror (the
// rich text editor) reads to scroll the selection into view
const emptyRects = (): DOMRectList => Object.assign([], { item: () => null })
Range.prototype.getClientRects = emptyRects
Range.prototype.getBoundingClientRect = (): DOMRect => new DOMRect()
document.elementFromPoint = (): Element | null => null

// Nor scrolling: the active option of a combobox is scrolled into view
Element.prototype.scrollIntoView = (): void => undefined
