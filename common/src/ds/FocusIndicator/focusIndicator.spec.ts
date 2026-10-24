import { theme as twakeTheme } from '@linagora/twake-mui'
import { createTheme, type Theme } from '@mui/material/styles'
import { deepmerge } from '@mui/utils'

import {
  FOCUS_RING,
  focusIndicatorThemeOptions,
  SCRIPT_FOCUS_TARGET,
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
  const styles: unknown =
    makeTheme(focusIndicator).components?.MuiCssBaseline?.styleOverrides
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

  it("keeps twake-mui's global CSS once merged into its theme", () => {
    // As TwakeMuiThemeProvider merges the options of the app into its own
    const merged: unknown = deepmerge(
      { components: twakeTheme.components },
      focusIndicatorThemeOptions('discreet')
    ).components?.MuiCssBaseline?.styleOverrides
    expect(merged).toMatchObject({
      'button, input, optgroup, select, textarea': { font: 'inherit' },
      ':root': { '--focus-ring-width': '1px' }
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

  it('removes the outline of the browser from the text fields when discreet only', () => {
    const textFieldRule = (styles: Record<string, unknown>): unknown =>
      Object.entries(styles).find(
        ([key]) =>
          key.startsWith(':where(') &&
          key.includes('[contenteditable="true"]') &&
          key.endsWith(':focus-visible')
      )?.[1]
    expect(textFieldRule(globalStyles('discreet'))).toEqual({
      outline: 'none'
    })
    expect(textFieldRule(globalStyles('enhanced'))).toBe(undefined)
  })

  it('leaves alone the headings and regions a script focuses', () => {
    const scriptFocused =
      ':is(h1, h2, h3, h4, h5, h6, [data-focus-target])[tabindex="-1"]'
    const styles = globalStyles('discreet')
    expect(focusSelector(styles)).toContain(scriptFocused)
    expect(styles[`${scriptFocused}:focus`]).toEqual({ outline: 'none' })
    expect(SCRIPT_FOCUS_TARGET).toEqual({ 'data-focus-target': '' })
  })
})
