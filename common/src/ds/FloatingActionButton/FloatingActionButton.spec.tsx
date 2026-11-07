import { Pen } from '@linagora/twake-icons'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
})
