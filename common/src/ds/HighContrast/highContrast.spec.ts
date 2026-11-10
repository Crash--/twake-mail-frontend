import { theme as twakeTheme } from '@linagora/twake-mui'
import { createTheme, getContrastRatio } from '@mui/material/styles'

import {
  FORCED_COLORS_CSS,
  HIGH_CONTRAST_COLORS,
  HIGH_CONTRAST_CSS,
  highContrastThemeOptions
} from './highContrast'

const WHITE = '#FFFFFF'
const PAGE_BACKGROUND = '#F3F6F9'

describe('high-contrast scheme', () => {
  const c = HIGH_CONTRAST_COLORS

  it.each([
    ['primary text', c.text],
    ['secondary text', c.textSecondary],
    ['placeholders and hints', c.outline],
    ['links and selected items', c.primary],
    ['errors', c.error],
    ['success', c.success],
    ['warnings', c.warning],
    ['information', c.info]
  ])('draws the %s at 4.5:1 at least on the backgrounds', (_, color) => {
    expect(getContrastRatio(color, WHITE)).toBeGreaterThanOrEqual(4.5)
    expect(getContrastRatio(color, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(4.5)
  })

  it('writes white at 4.5:1 at least on the filled buttons', () => {
    expect(getContrastRatio(WHITE, c.primary)).toBeGreaterThanOrEqual(4.5)
    expect(getContrastRatio(WHITE, c.error)).toBeGreaterThanOrEqual(4.5)
  })

  it('draws the focus outline at 3:1 at least on the backgrounds and the blue', () => {
    expect(getContrastRatio(c.focusRing, WHITE)).toBeGreaterThanOrEqual(3)
    expect(getContrastRatio(c.focusRing, c.selected)).toBeGreaterThanOrEqual(3)
  })

  it('changes the light scheme of twake-mui only', () => {
    // As TwakeMuiThemeProvider merges the options of the app into its own
    const theme = createTheme({
      cssVariables: { colorSchemeSelector: 'data-theme' },
      colorSchemes: {
        light: { palette: twakeTheme.colorSchemes.light?.palette },
        dark: { palette: twakeTheme.colorSchemes.dark?.palette }
      },
      ...highContrastThemeOptions()
    })
    const light = theme.colorSchemes.light?.palette
    expect(light?.primary.main).toBe(c.primary)
    expect(light?.text.primary).toBe(c.text)
    expect(light?.error.main).toBe(c.error)
    expect(theme.colorSchemes.light?.opacity.inputPlaceholder).toBe(0.64)
  })

  it('outlines the switched-off switches and the search field', () => {
    const selectors = Object.keys(HIGH_CONTRAST_CSS).join('\n')
    expect(selectors).toContain('.MuiSwitch-track')
    expect(selectors).toContain('.SearchBar-icon')
    expect(selectors).toContain('.MuiButton-text')
  })

  it('tells the switches apart and marks the selection under forced colours', () => {
    const rules = FORCED_COLORS_CSS['@media (forced-colors: active)']
    expect(rules).toMatchObject({
      ':root': { '--focus-ring-color': 'Highlight' },
      '.MuiSwitch-root .MuiSwitch-track': { border: '1px solid ButtonText' },
      '.MuiSwitch-root .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
        backgroundColor: 'Highlight'
      },
      '.MuiButton-contained': { border: '1px solid ButtonText' }
    })
  })
})
