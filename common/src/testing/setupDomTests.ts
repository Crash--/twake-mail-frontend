import '@testing-library/jest-dom'

import { TextDecoder, TextEncoder } from 'node:util'

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
