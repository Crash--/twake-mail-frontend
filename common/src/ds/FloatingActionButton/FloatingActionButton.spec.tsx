import { Pen } from '@linagora/twake-icons'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, type ReactElement } from 'react'

import { injectedCss } from '@/ds/testing/injectedCss'
import { renderDs } from '@/ds/testing/renderDs'

import { FloatingActionButton } from './FloatingActionButton'

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

  it('folds while the user scrolls the box it follows, and only that box', () => {
    function Followed(): ReactElement {
      const listRef = useRef<HTMLDivElement>(null)
      return (
        <>
          <div data-testid="sidebar" />
          <div ref={listRef} data-testid="list" />
          <FloatingActionButton label="Compose" icon={Pen} follow={listRef} />
        </>
      )
    }
    renderDs(<Followed />)
    const label = screen.getByText('Compose').parentElement

    fireEvent.wheel(screen.getByTestId('sidebar'))
    fireEvent.scroll(screen.getByTestId('sidebar'))
    expect(label).toHaveStyle({ gridTemplateColumns: '1fr' })

    fireEvent.wheel(screen.getByTestId('list'))
    fireEvent.scroll(screen.getByTestId('list'))
    expect(label).toHaveStyle({ gridTemplateColumns: '0fr' })
    expect(screen.getByRole('button', { name: 'Compose' })).toBeInTheDocument()
  })
})
