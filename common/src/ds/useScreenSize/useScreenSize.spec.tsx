import { act, fireEvent, screen } from '@testing-library/react'
import { useState, type ReactElement } from 'react'

import {
  LEGACY_MEDIA_LISTENERS,
  matchesViewport,
  mockViewport,
  resetViewport,
  type MediaQueryListMock
} from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'

import {
  SCREEN_QUERIES,
  useIsHandheld,
  useScreenSize,
  WithoutTablets
} from './useScreenSize'

const WIDTH_QUERIES: readonly string[] = [
  SCREEN_QUERIES.mobile,
  SCREEN_QUERIES.belowTabletLarge,
  SCREEN_QUERIES.belowDesktop
]

function ScreenSize(): ReactElement {
  return <p>{useScreenSize()}</p>
}

describe('useScreenSize', () => {
  afterEach(resetViewport)

  it.each([
    [320, 'mobile'],
    [599, 'mobile'],
    [600, 'tablet'],
    [899, 'tablet'],
    [900, 'tabletLarge'],
    [1199, 'tabletLarge'],
    [1200, 'desktop'],
    [1920, 'desktop']
  ])('calls a %i px wide screen %s', (width, size) => {
    mockViewport({ width })

    renderDs(<ScreenSize />)

    expect(screen.getByText(size)).toBeInTheDocument()
  })

  it('is a desktop when the browser cannot tell (no matchMedia)', () => {
    renderDs(<ScreenSize />)

    expect(screen.getByText('desktop')).toBeInTheDocument()
  })

  it.each([
    [599, 'mobile'],
    [600, 'desktop'],
    [1024, 'desktop'],
    [1440, 'desktop']
  ])('calls a %i px wide screen %s without tablets', (width, size) => {
    mockViewport({ width })

    renderDs(
      <WithoutTablets>
        <ScreenSize />
      </WithoutTablets>
    )

    expect(screen.getByText(size)).toBeInTheDocument()
  })

  describe('with a window that resizes', () => {
    const changeListeners = new Set<EventListenerOrEventListenerObject>()
    // The width queries listened to, whatever else the theme listens to
    let listenedWidthQueries = 0
    let width = 1440

    function resizeTo(newWidth: number): void {
      width = newWidth
      act(() => {
        const change = new Event('change')
        changeListeners.forEach(listener => {
          if (typeof listener === 'function') listener(change)
          else listener.handleEvent(change)
        })
      })
    }

    beforeEach(() => {
      width = 1440
      changeListeners.clear()
      listenedWidthQueries = 0
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: jest.fn((query: string): MediaQueryListMock => ({
          ...LEGACY_MEDIA_LISTENERS,
          get matches(): boolean {
            return matchesViewport(query, { width })
          },
          media: query,
          onchange: null,
          addEventListener: (
            _type: string,
            listener: EventListenerOrEventListenerObject
          ) => {
            if (WIDTH_QUERIES.includes(query)) listenedWidthQueries += 1
            changeListeners.add(listener)
          },
          removeEventListener: (
            _type: string,
            listener: EventListenerOrEventListenerObject
          ) => {
            if (WIDTH_QUERIES.includes(query)) listenedWidthQueries -= 1
            changeListeners.delete(listener)
          },
          dispatchEvent: () => false
        }))
      })
    })

    it('follows the breakpoints the window crosses', () => {
      renderDs(<ScreenSize />)

      resizeTo(1000)
      expect(screen.getByText('tabletLarge')).toBeInTheDocument()
      resizeTo(390)
      expect(screen.getByText('mobile')).toBeInTheDocument()
      resizeTo(1440)
      expect(screen.getByText('desktop')).toBeInTheDocument()
    })

    function Readers(): ReactElement {
      const [count, setCount] = useState(1)
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setCount(20)
            }}
          >
            More readers
          </button>
          {Array.from({ length: count }, (_, index) => (
            <ScreenSize key={index} />
          ))}
        </>
      )
    }

    it('shares one set of media listeners between its readers', () => {
      renderDs(<Readers />)
      const widthQueries = (): number =>
        jest
          .mocked(window.matchMedia)
          .mock.calls.filter(([query]) => WIDTH_QUERIES.includes(query)).length
      const queriesBefore = widthQueries()

      fireEvent.click(screen.getByRole('button', { name: 'More readers' }))

      // The three breakpoints, listened to once
      expect(listenedWidthQueries).toBe(3)
      // The new readers take the size the store holds
      expect(widthQueries()).toBe(queriesBefore)
      expect(screen.getAllByText('desktop')).toHaveLength(20)
    })

    it('stops listening once its last reader is gone', () => {
      const { unmount } = renderDs(<ScreenSize />)

      unmount()

      expect(listenedWidthQueries).toBe(0)
    })
  })
})

function Handheld(): ReactElement {
  return <p>{useIsHandheld() ? 'handheld' : 'not handheld'}</p>
}

describe('useIsHandheld', () => {
  afterEach(resetViewport)

  it.each([
    [390, false, 'handheld'],
    [390, true, 'handheld'],
    [820, true, 'handheld'],
    [1024, true, 'handheld'],
    [820, false, 'not handheld'],
    [1024, false, 'not handheld'],
    [1440, true, 'not handheld']
  ])('calls a %i px wide screen, touch %s, %s', (width, touch, answer) => {
    mockViewport({ width, touch })

    renderDs(<Handheld />)

    expect(screen.getByText(answer)).toBeInTheDocument()
  })
})
