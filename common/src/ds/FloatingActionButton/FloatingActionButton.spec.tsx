import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { Pen } from '@/ds/FlutterIcons/FlutterIcons'
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
    // tmail-flutter's: white on its blue (#208BFF)
    expect(getComputedStyle(button).color).toBe('rgb(255, 255, 255)')

    await userEvent.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('keeps its 60 px blue pill over twake-mui’s Fab size and touch-screen rules', () => {
    renderDs(<FloatingActionButton label="New message" icon={Pen} />)

    const button = screen.getByRole('button', { name: 'New message' })
    const style = getComputedStyle(button)
    expect(style.height).toBe('60px')
    expect(style.borderRadius).toBe('30px')
    expect(style.backgroundColor).toBe('rgb(32, 139, 255)')
    // twake-mui gives the primary Fab its pale `primary.light` on touch screens
    const [fabClass] = Array.from(button.classList).filter(name =>
      name.startsWith('css-')
    )
    expect(injectedCss()).toContain(
      `@media(hover:none){.${fabClass}.${fabClass}.${fabClass}{background-color:#208BFF;}`
    )
  })
})
