/**
 * The box of each search filter icon, in px. twake-icons draw edge to edge
 * where the Material icons of Teammail 1.1 keep a margin: at these sizes
 * the glyphs look as big as the mockup's (measured, then overlaid on its
 * "filters" bar). The attachment and "Don't include events" are other
 * drawings than the mockup's: sized to the same height.
 */
export const FILTER_ICON_SIZES = {
  folder: 13,
  label: 13,
  person: 11,
  calendar: 16,
  attachment: 14,
  star: 14,
  unread: 13,
  events: 15
} as const
