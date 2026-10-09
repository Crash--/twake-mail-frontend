// Upstream to twake-ui: no, the colours of tmail-flutter the app draws with.
// The light scheme keeps each of them exactly; the dark scheme gives each the
// colour of twake-mui's dark palette that plays the same part (text, muted
// text, paper, divider, primary…). One table, read twice: by the theme, which
// writes a CSS variable per colour and per scheme, and by `@/ds/`, which draws
// with those variables (`TMAIL`). A component never writes a colour of the
// interface in hex: it takes the token whose light value is that colour, or
// adds one here with its dark counterpart.
import type { ThemeOptions } from '@mui/material/styles'

/** twake-mui's dark palette, as the CSS variables of the theme */
const DARK = {
  text: 'var(--twake-palette-text-primary)',
  textSecondary: 'var(--twake-palette-text-secondary)',
  textDisabled: 'var(--twake-palette-text-disabled)',
  paper: 'var(--twake-palette-background-paper)',
  background: 'var(--twake-palette-background-default)',
  divider: 'var(--twake-palette-divider)',
  border: 'var(--twake-palette-border-main)',
  hover: 'var(--twake-palette-action-hover)',
  selected: 'var(--twake-palette-action-selected)',
  disabled: 'var(--twake-palette-action-disabled)',
  disabledBackground: 'var(--twake-palette-action-disabledBackground)',
  primary: 'var(--twake-palette-primary-main)',
  primaryTint: 'rgba(var(--twake-palette-primary-mainChannel) / 0.16)',
  primaryHover: 'rgba(var(--twake-palette-primary-mainChannel) / 0.08)',
  error: 'var(--twake-palette-error-main)',
  errorTint: 'rgba(var(--twake-palette-error-mainChannel) / 0.12)',
  paperVeil: 'rgba(var(--twake-palette-background-paperChannel) / 0.85)'
} as const

/** Each token: [its colour in the light scheme, as tmail-flutter; in the dark one] */
const TOKENS = {
  // Text: black and the dark greys of tmail-flutter
  textBlack: ['#000000', DARK.text],
  textOnSurface: ['#1C1B1F', DARK.text],
  textGrey: ['#424244', DARK.text],
  textGrey90: ['rgba(66, 66, 68, 0.9)', DARK.text],
  textInk: ['#222222', DARK.text],
  textBlack85: ['rgba(0, 0, 0, 0.85)', DARK.text],
  textBlack88: ['rgba(0, 0, 0, 0.88)', DARK.text],
  textBlack90: ['rgba(0, 0, 0, 0.9)', DARK.text],
  textInk85: ['rgba(26, 26, 26, 0.85)', DARK.text],
  // Muted text and icons: its steel and mid greys
  steel: ['#55687D', DARK.textSecondary],
  steelLight: ['#8C9CAF', DARK.textSecondary],
  steelPale: ['#9AA7B6', DARK.textSecondary],
  grey: ['#818C99', DARK.textSecondary],
  greyDark: ['#686E76', DARK.textSecondary],
  greySlate: ['#6D7885', DARK.textSecondary],
  greyMid: ['#71767C', DARK.textSecondary],
  greyIcon: ['#99A2AD', DARK.textSecondary],
  greyLavender: ['#7E869B', DARK.textSecondary],
  greyStar: ['#959DAD', DARK.textSecondary],
  grey777: ['#777778', DARK.textSecondary],
  grey757: ['#757575', DARK.textSecondary],
  textGrey64: ['rgba(66, 66, 68, 0.64)', DARK.textSecondary],
  textGrey72: ['rgba(66, 66, 68, 0.72)', DARK.textSecondary],
  textGrey66At64: ['rgba(66, 66, 66, 0.64)', DARK.textSecondary],
  textOnSurface48: ['rgba(28, 27, 31, 0.48)', DARK.textSecondary],
  textPlaceholderAi: ['rgba(155, 155, 155, 0.85)', DARK.textSecondary],
  // Faint text and icons: placeholders, unchecked, disabled
  greyFaint: ['#AEB7C2', DARK.textDisabled],
  greyPlaceholder: ['#A9B4C2', DARK.textDisabled],
  greyBlueFaint: ['#AEAEC0', DARK.textDisabled],
  greySizeLabel: ['#ADADC0', DARK.textDisabled],
  greyChevron: ['#B8C1CC', DARK.textDisabled],
  greyHandle: ['#49454F', DARK.textDisabled],
  grey939: ['#939393', DARK.textDisabled],
  textGrey38: ['rgba(66, 66, 68, 0.38)', DARK.textDisabled],
  textGrey32: ['rgba(66, 66, 68, 0.32)', DARK.textDisabled],
  textOnSurface38: ['rgba(28, 27, 31, 0.38)', DARK.textDisabled],
  // Surfaces
  surface: ['#FFFFFF', DARK.paper],
  background: ['#F3F6F9', DARK.background],
  // Filled controls: chips, fields, toolbar buttons, selected rows of a menu
  fillF2: ['#F2F3F5', DARK.hover],
  fillF3: ['#F3F4F6', DARK.hover],
  fillF4: ['#F4F4F4', DARK.hover],
  fillF4F5: ['#F4F4F5', DARK.hover],
  fillF7: ['#F7F6F9', DARK.hover],
  fillF8: ['#F8F8F8', DARK.hover],
  fillF9: ['#F9FAFB', DARK.hover],
  fillChip: ['#ECEEF1', DARK.hover],
  fillSelected: ['#EAEDF2', DARK.hover],
  fillSearch: ['#E0E9F1', DARK.hover],
  fillToolbar: ['rgba(235, 237, 240, 0.6)', DARK.hover],
  fillTrack: ['rgba(228, 232, 236, 0.6)', DARK.hover],
  fillSuggestion: ['rgba(222, 226, 231, 0.5)', DARK.hover],
  fillTonal: ['rgba(73, 69, 79, 0.08)', DARK.hover],
  fillSlate: ['rgba(109, 120, 133, 0.08)', DARK.hover],
  fillNeutral: ['rgba(121, 116, 126, 0.08)', DARK.hover],
  fillSwitchOff: ['#D3D3D3', DARK.disabled],
  fillEB: ['#EBEDF0', DARK.selected],
  fillToolbarHover: ['rgba(235, 237, 240, 1)', DARK.selected],
  fillSelectedHover: ['#DFE3EA', DARK.selected],
  // Hover veils
  hoverBlack: ['rgba(0, 0, 0, 0.04)', DARK.hover],
  hoverBackground: ['#F3F6F9', DARK.hover],
  hoverInk: ['rgba(29, 25, 43, 0.04)', DARK.hover],
  hoverOnSurface: ['rgba(28, 27, 31, 0.04)', DARK.hover],
  hoverOnSurface08: ['rgba(28, 27, 31, 0.08)', DARK.hover],
  disabledFill: ['rgba(28, 27, 31, 0.12)', DARK.disabledBackground],
  // Pale blues: selected rows, key caps, empty states, light primary buttons
  blueSelected: ['#DFEEFF', DARK.primaryTint],
  blueDisabled: ['#D2E9FF', DARK.primaryTint],
  bluePale: ['#E0EDFF', DARK.primaryTint],
  blueWash: ['#F6FAFF', DARK.primaryTint],
  blueHover: ['rgba(0, 122, 255, 0.08)', DARK.primaryHover],
  blueHover06: ['rgba(10, 132, 255, 0.06)', DARK.primaryHover],
  blueDropVeil: ['rgba(246, 250, 255, 0.7)', DARK.paperVeil],
  // Pale reds: fields in error
  redWash: ['#FFF6F6', DARK.errorTint],
  redPale: ['#FAEBEB', DARK.errorTint],
  // Borders and dividers
  divider: ['#E7E8EC', DARK.divider],
  outline: ['#E6E1E5', DARK.divider],
  outlineField: ['#E3E5E8', DARK.divider],
  outlineCard: ['#E5ECF3', DARK.divider],
  outlineF4: ['#F4F4F4', DARK.divider],
  outlineChip: ['#F3F6F9', DARK.divider],
  outlineSticky: ['#D7D8D9', DARK.divider],
  outlineKey: ['#CCCCCC', DARK.divider],
  outlineSwatch: ['#CDCDCD', DARK.divider],
  divider08: ['rgba(0, 0, 0, 0.08)', DARK.divider],
  divider12: ['rgba(0, 0, 0, 0.12)', DARK.divider],
  dividerGrey12: ['rgba(66, 66, 68, 0.12)', DARK.divider],
  outlineHover: ['#C6CBD1', DARK.border],
  outline24: ['rgba(0, 0, 0, 0.24)', DARK.border],
  scrollbarThumb: ['#C1C1C1', DARK.border],
  // Blue text, icons and outlines (a blue filled button keeps its blue)
  primary: ['#007AFF', DARK.primary],
  primary0A: ['#0A84FF', DARK.primary],
  primaryBack: ['#0F76E7', DARK.primary],
  // Red text, icons and outlines
  error: ['#FF3347', DARK.error],
  errorLogin: ['#E64646', DARK.error]
} as const satisfies Record<string, readonly [string, string]>

export type TmailColor = keyof typeof TOKENS

const NAMES = Object.keys(TOKENS) as TmailColor[]

function scheme(index: 0 | 1): Record<TmailColor, string> {
  return Object.fromEntries(
    NAMES.map(name => [name, TOKENS[name][index]])
  ) as Record<TmailColor, string>
}

/**
 * The colours to draw with, as CSS variables of the theme (`palette.tmail`);
 * outside it (a test rendering a lone component), their light value
 */
export const TMAIL = Object.fromEntries(
  NAMES.map(name => [
    name,
    `var(--twake-palette-tmail-${name}, ${TOKENS[name][0]})`
  ])
) as Record<TmailColor, string>

/** The theme options writing those variables, for each colour scheme */
export function tmailColorsThemeOptions(): ThemeOptions {
  // `tmail` is not a palette key MUI knows: the theme still writes its
  // variables, nothing reads it as a palette entry
  const colorSchemes = {
    light: { palette: { tmail: scheme(0) } },
    dark: { palette: { tmail: scheme(1) } }
  }
  return { colorSchemes } as ThemeOptions
}
