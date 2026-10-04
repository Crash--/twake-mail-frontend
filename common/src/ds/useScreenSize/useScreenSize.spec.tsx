import { screen } from '@testing-library/react'
import type { ReactElement } from 'react'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'

import { useScreenSize } from './useScreenSize'

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
})
