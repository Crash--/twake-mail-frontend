import {
  TwakeMuiThemeProvider,
  useTheme,
  type Theme
} from '@linagora/twake-mui'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

import { TMAIL, tmailColorsThemeOptions } from './tmailColors'

function readTheme(): Theme {
  const seen: { theme: Theme | null } = { theme: null }
  function Probe(): ReactElement | null {
    seen.theme = useTheme()
    return null
  }
  render(
    <TwakeMuiThemeProvider themeOptions={tmailColorsThemeOptions()}>
      <Probe />
    </TwakeMuiThemeProvider>
  )
  if (seen.theme === null) throw new Error('No theme')
  return seen.theme
}

/** The `tmail` entry of a palette, which MUI's types do not declare */
function tmailOf(palette: object | undefined): Record<string, string> {
  const value: unknown =
    palette === undefined ? undefined : Reflect.get(palette, 'tmail')
  if (typeof value !== 'object' || value === null) throw new Error('No tmail')
  return value as Record<string, string>
}

describe('tmailColors', () => {
  it('draws with the variables the theme writes, the light colour as fallback', () => {
    const theme = readTheme()
    expect(tmailOf(theme.vars.palette).textBlack).toBe(
      'var(--twake-palette-tmail-textBlack)'
    )
    expect(TMAIL.textBlack).toBe(
      'var(--twake-palette-tmail-textBlack, #000000)'
    )
  })

  it("keeps tmail-flutter's colour in the light scheme, twake-mui's in the dark one", () => {
    const theme = readTheme()
    const light = tmailOf(theme.colorSchemes.light?.palette)
    const dark = tmailOf(theme.colorSchemes.dark?.palette)
    expect(light.steel).toBe('#55687D')
    expect(dark.steel).toBe('var(--twake-palette-text-secondary)')
    expect(dark.surface).toBe('var(--twake-palette-background-paper)')
  })
})
