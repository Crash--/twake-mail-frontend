// Upstream to twake-ui: yes. A coloured tag (labels, categories) with an
// optional remove button; twake-mui's Chip takes no arbitrary colour.
import { Box, ButtonBase, Tooltip } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const WHITE = '#FFFFFF'
const DARK_NEUTRAL = '#424244'
/** Below this contrast with white, the background is light or pastel */
const MIN_WHITE_CONTRAST = 2
/**
 * Below this chroma, the background is a grey (chroma, not HSL saturation,
 * which runs high on a near-white tint such as #F3F6F9)
 */
const MAX_GREY_CHROMA = 0.08
/** The lightness of the text derived from the hue of a pastel background */
const DARK_TEXT_LIGHTNESS = 0.2

function toHex(channels: readonly number[]): string {
  return `#${channels
    .map(channel =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()}`
}

/**
 * The text of a tag on `background`: white, unless the background is too
 * light for it; then a dark neutral on a grey, or a dark shade of its hue
 */
export function tagTextColor(background: string): string {
  const hex = /^#?([0-9a-f]{6})$/i.exec(background.trim())?.[1]
  if (!hex) return WHITE
  const [r = 0, g = 0, b = 0] = [0, 2, 4].map(
    start => Number.parseInt(hex.slice(start, start + 2), 16) / 255
  )
  const [lr = 0, lg = 0, lb = 0] = [r, g, b].map(channel =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  )
  const luminance = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
  if (1.05 / (luminance + 0.05) >= MIN_WHITE_CONTRAST) return WHITE

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
  if (delta < MAX_GREY_CHROMA) return DARK_NEUTRAL

  const hue =
    max === r
      ? ((g - b) / delta + 6) % 6
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4
  // HSL to RGB at the dark lightness, same hue and saturation
  const chroma = (1 - Math.abs(2 * DARK_TEXT_LIGHTNESS - 1)) * saturation
  const x = chroma * (1 - Math.abs((hue % 2) - 1))
  const m = DARK_TEXT_LIGHTNESS - chroma / 2
  const sector = Math.floor(hue)
  const [cr, cg, cb] = (
    [
      [chroma, x, 0],
      [x, chroma, 0],
      [0, chroma, x],
      [0, x, chroma],
      [x, 0, chroma],
      [chroma, 0, x]
    ] as const
  )[sector] ?? [0, 0, 0]
  return toHex([cr + m, cg + m, cb + m])
}

/** The height of a tag: its line, and room for its 16 px × */
const TAG_HEIGHT = { small: '16px', medium: '20px' } as const

export interface ColorTagProps {
  label: string
  /** `#RRGGBB` */
  color: string
  /** Shows a × button; its accessible name and tooltip */
  removeLabel?: string
  onRemove?: () => void
  /** `small`: 11 / 14 text and 4 px of padding, the tags of a list row */
  size?: 'small' | 'medium'
  /**
   * Cut the name to this many characters, ellipsis included (tmail-flutter's
   * `LabelUtils.truncateLabel`: 15 characters and "...")
   */
  maxLength?: number
  /** Shows the whole name in a tooltip on hover (tmail-flutter on the web) */
  hasTooltip?: boolean
  /** The colour of the text; by default `tagTextColor(color)` */
  textColor?: string
  'data-testid'?: string
}

/** A small tag in a colour, with an optional × removing it */
export function ColorTag({
  label,
  color,
  removeLabel,
  onRemove,
  maxLength,
  hasTooltip = false,
  size = 'medium',
  textColor = tagTextColor(color),
  'data-testid': testId
}: ColorTagProps): ReactElement {
  const shown =
    maxLength !== undefined && label.length > maxLength
      ? `${label.slice(0, maxLength - 1)}...`
      : label
  const isCut = shown !== label
  // A name too long for the room left ends with an ellipsis, rather than
  // pushing the × out of its line
  const text = (
    <Box
      component="span"
      sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
    >
      {isCut ? (
        <>
          <span aria-hidden="true">{shown}</span>
          <span className="u-visuallyhidden">{label}</span>
        </>
      ) : (
        label
      )}
    </Box>
  )

  return (
    <Box
      component="span"
      title={!hasTooltip && isCut ? label : undefined}
      data-testid={testId}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: '100%',
        // The same height whatever the name (an emoji, a glyph from a
        // fallback font) and with or without its ×
        boxSizing: 'border-box',
        height: TAG_HEIGHT[size],
        borderRadius: '4px',
        px: size === 'small' ? 0.5 : 0.75,
        backgroundColor: color,
        color: textColor,
        fontSize: size === 'small' ? '11px' : '0.75rem',
        lineHeight: size === 'small' ? '14px' : 1.5,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        // Above the overlay of a row link (its `::after`), so that the
        // pointer reaches the tooltip; a click still goes to the link
        ...(hasTooltip ? { position: 'relative', zIndex: 1 } : {})
      }}
    >
      {hasTooltip ? (
        // Interactive: the pointer may move onto it without closing it
        // (WCAG 1.4.13, content on hover is hoverable)
        <Tooltip title={label} describeChild>
          {text}
        </Tooltip>
      ) : (
        text
      )}
      {onRemove && removeLabel ? (
        <Tooltip title={removeLabel}>
          <ButtonBase
            aria-label={removeLabel}
            onClick={onRemove}
            sx={{
              flexShrink: 0,
              ml: 0.5,
              width: 16,
              height: 16,
              borderRadius: '50%',
              color: textColor,
              fontSize: '0.875rem',
              lineHeight: 1,
              '--focus-ring-color': textColor
            }}
          >
            ×
          </ButtonBase>
        </Tooltip>
      ) : null}
    </Box>
  )
}
