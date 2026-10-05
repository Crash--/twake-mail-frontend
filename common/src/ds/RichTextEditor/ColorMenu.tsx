// Upstream to twake-ui: with RichTextEditor. A popover to pick a text
// colour: swatches (native radio group) and a free colour.
import { Box, Button, Popover, Typography } from '@linagora/twake-mui'
import type { KeyboardEvent, MouseEvent, ReactElement } from 'react'

import { ColorSwatchPicker } from '@/ds/ColorSwatchPicker/ColorSwatchPicker'

import type { RichTextColor } from './types'

export interface ColorMenuProps {
  anchor: HTMLElement | null
  /** Accessible name of the popover */
  title: string
  colors: readonly RichTextColor[]
  /** The colour of the selection, `#rrggbb`; empty for the default */
  value: string
  /** Name of the free colour input */
  customLabel: string
  /** `null` resets */
  onPick: (color: string | null) => void
  onClose: () => void
  'data-testid'?: string
}

/** `rgb(1, 2, 3)` or `#abc` as `#rrggbb`, for the swatches and the input */
export function toHex(value: string): string {
  const trimmed = value.trim().toLowerCase()
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(trimmed)
  if (rgb) {
    return `#${[rgb[1], rgb[2], rgb[3]]
      .map(part => Number(part).toString(16).padStart(2, '0'))
      .join('')}`
  }
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(trimmed)
  if (short)
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
  return trimmed
}

/**
 * Swatches of the palette, then a free colour. The arrows move the choice
 * in the group and apply it; a click applies it and closes, Enter or
 * Escape close.
 */
export function ColorMenu({
  anchor,
  title,
  colors,
  value,
  customLabel,
  onPick,
  onClose,
  'data-testid': testId
}: ColorMenuProps): ReactElement {
  const reset = colors.find(color => color.value === null)
  const swatches = colors.flatMap(color =>
    color.value === null ? [] : [{ value: color.value, label: color.label }]
  )
  const current = toHex(value)

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault()
      onClose()
    }
  }
  // A keyboard "click" (arrows in the group) has no detail: keep it open
  const handleClick = (event: MouseEvent<HTMLElement>): void => {
    if (event.detail > 0 && event.target instanceof HTMLInputElement) {
      if (event.target.type === 'radio') onClose()
    }
  }

  return (
    <Popover
      open={anchor !== null}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-label': title
        }
      }}
    >
      <Box
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        data-testid={testId}
        sx={{ p: 2, width: 'min(384px, calc(100vw - 16px))' }}
      >
        <ColorSwatchPicker
          legend={title}
          swatches={swatches}
          value={
            swatches.some(swatch => swatch.value === current) ? current : null
          }
          onChange={color => {
            onPick(color)
          }}
        />
        {reset ? (
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              onPick(null)
              onClose()
            }}
            sx={{ mt: 1.5, textTransform: 'none' }}
          >
            {reset.label}
          </Button>
        ) : null}
        <Box
          component="label"
          sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}
        >
          <Box
            component="input"
            type="color"
            value={
              current.startsWith('#') && current.length === 7
                ? current
                : '#000000'
            }
            onChange={event => {
              onPick(event.target.value)
            }}
            sx={{
              width: 40,
              height: 28,
              p: 0,
              border: 0,
              bgcolor: 'transparent'
            }}
          />
          <Typography variant="body2">{customLabel}</Typography>
        </Box>
      </Box>
    </Popover>
  )
}
