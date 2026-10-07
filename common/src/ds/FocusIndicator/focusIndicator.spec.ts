import { createTheme, type Theme } from '@mui/material/styles'

import {
  FOCUS_RING,
  focusIndicatorThemeOptions,
  type FocusIndicator
} from './focusIndicator'

function makeTheme(focusIndicator: FocusIndicator): Theme {
  // As twake-mui does, so that the theme has its CSS variables
  return createTheme({
    cssVariables: true,
    ...focusIndicatorThemeOptions(focusIndicator)
  })
}

function globalStyles(focusIndicator: FocusIndicator): Record<string, unknown> {
  const theme = makeTheme(focusIndicator)
  const overrides = theme.components?.MuiCssBaseline?.styleOverrides
  if (typeof overrides !== 'function') throw new Error('No global styles')
  const styles: unknown = overrides(theme)
  if (typeof styles !== 'object' || styles === null) {
    throw new Error('No global styles')
  }
  return styles as Record<string, unknown>
}

function focusSelector(styles: Record<string, unknown>): string {
  const selector = Object.keys(styles).find(key =>
    key.startsWith(':focus-visible')
  )
  if (selector === undefined) throw new Error('No focus rule')
  return selector
}

describe('focusIndicatorThemeOptions', () => {
  it('sets the width of the outline from the choice of the user', () => {
    expect(globalStyles('discreet')[':root']).toMatchObject({
      '--focus-ring-width': '1px',
      '--focus-ring-offset': '2px'
    })
    expect(globalStyles('enhanced')[':root']).toMatchObject({
      '--focus-ring-width': '3px'
    })
  })

  it('outlines what has the keyboard focus, MUI buttons included', () => {
    const styles = globalStyles('discreet')
    expect(styles[focusSelector(styles)]).toEqual(FOCUS_RING)
    expect(
      makeTheme('discreet').components?.MuiButtonBase?.styleOverrides?.root
    ).toEqual({ '&.Mui-focusVisible': FOCUS_RING })
  })

  it('leaves the text fields alone when discreet, the editor not when enhanced', () => {
    expect(focusSelector(globalStyles('discreet'))).toContain(
      '[contenteditable="true"]'
    )
    expect(focusSelector(globalStyles('enhanced'))).not.toContain(
      'contenteditable'
    )
  })
})
