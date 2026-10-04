import { injectedCss } from '@/ds/testing/injectedCss'
import { renderDs } from '@/ds/testing/renderDs'

import { TOUCH_MEDIA, TouchTargets } from './TouchTargets'

describe('TouchTargets', () => {
  it('grows icon buttons to 44 px on touch screens and phones', () => {
    renderDs(<TouchTargets />)

    expect(TOUCH_MEDIA).toBe('@media (pointer: coarse), (max-width:599.95px)')
    expect(injectedCss()).toMatch(
      /@media\(pointer:coarse\),\(max-width:599\.95px\)\{\.MuiIconButton-root\{min-width:44px;min-height:44px;\}/
    )
  })
})
