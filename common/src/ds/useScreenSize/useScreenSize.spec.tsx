import { screen } from '@testing-library/react'
import type { ReactElement } from 'react'

import { mockViewport, resetViewport } from '@/ds/testing/mockViewport'
import { renderDs } from '@/ds/testing/renderDs'

import { useIsHandheld, useScreenSize, WithoutTablets } from './useScreenSize'

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
