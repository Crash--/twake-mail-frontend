import { tagTextColor } from '@/ds/ColorTag/ColorTag'
import type { TranslationKey } from '@common/i18n/useI18n'

export interface LabelPaletteColor {
  name: TranslationKey
  /** The text on this colour, when white does not read on it */
  textColor?: string
}

/** twake-mui's `COLORS`, the swatches of the label dialog */
export const LABEL_PALETTE: Readonly<Record<string, LabelPaletteColor>> = {
  '#273891': { name: 'labels.colors.navyBlue' },
  '#7E57E3': { name: 'labels.colors.purple' },
  '#9E83E8': { name: 'labels.colors.lavender' },
  '#91CEF6': { name: 'labels.colors.skyBlue', textColor: '#083C5E' },
  '#2D83FF': { name: 'labels.colors.brightBlue' },
  '#006BD8': { name: 'labels.colors.royalBlue' },
  '#038199': { name: 'labels.colors.petrolBlue' },
  '#51B588': { name: 'labels.colors.green' },
  '#457D6C': { name: 'labels.colors.darkGreen' },
  '#1EBBCC': { name: 'labels.colors.turquoise' },
  '#E0465C': { name: 'labels.colors.red' },
  '#ED20A4': { name: 'labels.colors.magenta' },
  '#ED768D': { name: 'labels.colors.pink' },
  '#B85B17': { name: 'labels.colors.brown' },
  '#EDA91D': { name: 'labels.colors.orange' },
  '#BA8144': { name: 'labels.colors.lightBrown' },
  '#ED916B': { name: 'labels.colors.salmon' },
  '#EDC661': { name: 'labels.colors.yellow', textColor: '#5C450A' },
  '#131326': { name: 'labels.colors.black' },
  '#646580': { name: 'labels.colors.grey' }
}

/**
 * The text of a label on `color`: white, or the colour the palette sets next
 * to it; a free colour (a hex code) follows the same rule, derived from it
 */
export function labelTextColor(color: string): string {
  return LABEL_PALETTE[color.toUpperCase()]?.textColor ?? tagTextColor(color)
}
