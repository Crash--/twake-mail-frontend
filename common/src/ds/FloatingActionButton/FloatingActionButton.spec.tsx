import { Pen } from '@linagora/twake-icons'
import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { injectedCss } from '@/ds/testing/injectedCss'
import { renderDs } from '@/ds/testing/renderDs'

import { FloatingActionButton, SCROLL_IDLE_DELAY } from './FloatingActionButton'

describe('FloatingActionButton', () => {
  it('is a labelled button fixed at the bottom of the screen', async () => {
    const onClick = jest.fn()
    renderDs(
      <FloatingActionButton
        label="New message"
        icon={Pen}
        onClick={onClick}
        data-testid="fab"
      />
    )

    const button = screen.getByRole('button', { name: 'New message' })
    expect(button).toHaveTextContent('New message')
    expect(button).toBe(screen.getByTestId('fab'))
    expect(getComputedStyle(button).position).toBe('fixed')
    // The text colour of twake-mui's primary Fab
    expect(getComputedStyle(button).color).toBe(
      'var(--twake-palette-primary-dark)'
    )

    await userEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('keeps twake-mui’s pale background under its dark label on touch screens', () => {
    renderDs(<FloatingActionButton label="New message" icon={Pen} />)

    const button = screen.getByRole('button', { name: 'New message' })
    const style = getComputedStyle(button)
    // A white label on this background was about 1.3:1 (issue #733)
    expect(style.color).toBe('var(--twake-palette-primary-dark)')
    expect(style.backgroundColor).toBe('var(--twake-palette-primary-light)')
    const [fabClass] = Array.from(button.classList).filter(name =>
      name.startsWith('css-')
    )
    expect(injectedCss()).toContain(
      `@media(hover:none){.${fabClass}{background-color:var(--twake-palette-primary-light);}}`
    )
  })

  describe('while the page scrolls', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })
    afterEach(() => {
      jest.useRealTimers()
    })

    function renderOverList(): HTMLElement {
      renderDs(
        <>
          <div data-testid="list" />
          <FloatingActionButton label="Compose" icon={Pen} />
        </>
      )
      return screen.getByRole('button', { name: 'Compose' })
    }

    it('folds to its icon while the user scrolls, and unfolds once the scrolling stops', () => {
      const button = renderOverList()
      expect(button).toHaveAttribute('data-folded', 'false')

      fireEvent.wheel(screen.getByTestId('list'))
      fireEvent.scroll(screen.getByTestId('list'))

      expect(button).toHaveAttribute('data-folded', 'true')
      expect(screen.getByRole('button', { name: 'Compose' })).toBe(button)
      expect(screen.getByText('Compose').parentElement).toHaveStyle({
        gridTemplateColumns: '0fr'
      })

      // A momentum goes on without a gesture: still the user's scrolling
      act(() => {
        jest.advanceTimersByTime(SCROLL_IDLE_DELAY - 1)
      })
      fireEvent.scroll(screen.getByTestId('list'))
      act(() => {
        jest.advanceTimersByTime(SCROLL_IDLE_DELAY - 1)
      })
      expect(button).toHaveAttribute('data-folded', 'true')

      act(() => {
        jest.advanceTimersByTime(1)
      })
      expect(button).toHaveAttribute('data-folded', 'false')
    })

    it('stays unfolded while a list scrolls itself back to where it was, whenever it does', () => {
      const button = renderOverList()

      fireEvent.scroll(screen.getByTestId('list'))
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      fireEvent.scroll(screen.getByTestId('list'))

      expect(button).toHaveAttribute('data-folded', 'false')
    })

    it('stays folded through a momentum that outlasts the gesture', () => {
      const button = renderOverList()
      const list = screen.getByTestId('list')

      fireEvent.wheel(list)
      fireEvent.scroll(list)
      for (let step = 0; step < 2; step += 1) {
        act(() => {
          jest.advanceTimersByTime(200)
        })
        fireEvent.scroll(list)
      }
      act(() => {
        jest.advanceTimersByTime(200)
      })

      // The last scroll came 400 ms after the wheel
      expect(button).toHaveAttribute('data-folded', 'true')
    })

    it('folds for a finger that drags the content', () => {
      const button = renderOverList()

      fireEvent.touchMove(screen.getByTestId('list'))
      fireEvent.scroll(screen.getByTestId('list'))

      expect(button).toHaveAttribute('data-folded', 'true')
    })

    it('folds for the keys that scroll, not for the others', () => {
      const button = renderOverList()

      fireEvent.keyDown(screen.getByTestId('list'), { key: 'Escape' })
      fireEvent.scroll(screen.getByTestId('list'))
      expect(button).toHaveAttribute('data-folded', 'false')

      fireEvent.keyDown(screen.getByTestId('list'), { key: 'PageDown' })
      fireEvent.scroll(screen.getByTestId('list'))
      expect(button).toHaveAttribute('data-folded', 'true')
    })
  })
})
