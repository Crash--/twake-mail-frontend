// Upstream to twake-ui: yes. A coloured tag (labels, categories) with an
// optional remove button; twake-mui's Chip takes no arbitrary colour.
import { Box, ButtonBase, Tooltip } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

/** Black or white, whichever reads best on `background` (WCAG luminance) */
export function readableTextColor(background: string): '#000000' | '#FFFFFF' {
  const hex = /^#?([0-9a-f]{6})$/i.exec(background.trim())?.[1]
  if (!hex) return '#FFFFFF'
  const [r = 0, g = 0, b = 0] = [0, 2, 4].map(start => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  // Contrast with white: 1.05 / (L + 0.05); with black: (L + 0.05) / 0.05
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05
    ? '#FFFFFF'
    : '#000000'
}

export interface ColorTagProps {
  label: string
  /** `#RRGGBB` */
  color: string
  /** Shows a × button; its accessible name and tooltip */
  removeLabel?: string
  onRemove?: () => void
  /** `small`: 11 / 14 text and 4 px of padding, the tags of a list row */
  size?: 'small' | 'medium'
  /** Cut the name after this many characters, with an ellipsis */
  maxLength?: number
  'data-testid'?: string
}

/**
 * A small tag in a colour, its text black or white for contrast, with an
 * optional × removing it
 */
export function ColorTag({
  label,
  color,
  removeLabel,
  onRemove,
  maxLength,
  size = 'medium',
  'data-testid': testId
}: ColorTagProps): ReactElement {
  const textColor = readableTextColor(color)
  const shown =
    maxLength !== undefined && label.length > maxLength
      ? `${label.slice(0, maxLength)}…`
      : label

  return (
    <Box
      component="span"
      title={shown === label ? undefined : label}
      data-testid={testId}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: '100%',
        borderRadius: '4px',
        px: size === 'small' ? 0.5 : 0.75,
        py: size === 'small' ? 0 : 0.125,
        backgroundColor: color,
        color: textColor,
        fontSize: size === 'small' ? '11px' : '0.75rem',
        lineHeight: size === 'small' ? '14px' : 1.5,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle'
      }}
    >
      <Box
        component="span"
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {shown}
      </Box>
      {onRemove && removeLabel ? (
        <Tooltip title={removeLabel}>
          <ButtonBase
            aria-label={removeLabel}
            onClick={onRemove}
            sx={{
              ml: 0.5,
              width: 16,
              height: 16,
              borderRadius: '50%',
              color: textColor,
              fontSize: '0.875rem',
              lineHeight: 1,
              '&:focus-visible': { outline: `2px solid ${textColor}` }
            }}
          >
            ×
          </ButtonBase>
        </Tooltip>
      ) : null}
    </Box>
  )
}
