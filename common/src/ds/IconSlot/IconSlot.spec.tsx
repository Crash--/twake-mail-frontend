import { screen } from '@testing-library/react'

import { injectedCss } from '@/ds/testing/injectedCss'
import { renderDs } from '@/ds/testing/renderDs'

import { IconSlot } from './IconSlot'

describe('IconSlot', () => {
  it('holds its button in a column 2rem wide, 44 px on touch screens', () => {
    renderDs(
      <IconSlot>
        <button type="button">Expand</button>
      </IconSlot>
    )

    const slot = screen.getByRole('button', { name: 'Expand' }).parentElement
    expect(slot).toHaveStyle({ width: '2rem' })
    const slotClass = Array.from(slot?.classList ?? []).find(name =>
      name.startsWith('css-')
    )
    expect(injectedCss()).toContain(
      `@media(pointer:coarse),(max-width:599.95px){.${slotClass ?? ''}{width:44px;}}`
    )
  })
})
