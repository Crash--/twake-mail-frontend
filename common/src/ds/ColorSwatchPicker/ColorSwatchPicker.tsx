// Upstream to twake-ui: yes. Picking a colour among swatches (labels,
// calendars, tags) is common to Twake apps; twake-mui has no colour input.
import { Box, Typography } from '@linagora/twake-mui'
import { useId, type ChangeEvent, type ReactElement } from 'react'

import { FOCUS_RING } from '@/ds/FocusIndicator/focusIndicator'

export interface ColorSwatch {
  /** `#RRGGBB` */
  value: string
  /** Accessible name, e.g. "Navy blue" */
  label: string
}

export interface ColorSwatchPickerProps {
  /** Visible name of the group */
  legend: string
  swatches: readonly ColorSwatch[]
  /** The colour chosen, null for none */
  value: string | null
  onChange: (value: string) => void
  'data-testid'?: string
}

const SIZE = 28

function sameColor(a: string | null, b: string): boolean {
  return a !== null && a.toLowerCase() === b.toLowerCase()
}

/**
 * Colour swatches as a native radio group: arrows move the choice, the
 * focus ring and the selected ring are visible, each swatch has a name.
 */
export function ColorSwatchPicker({
  legend,
  swatches,
  value,
  onChange,
  'data-testid': testId
}: ColorSwatchPickerProps): ReactElement {
  const name = useId()

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.value)
  }

  return (
    <Box
      component="fieldset"
      sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
      data-testid={testId}
    >
      <Typography component="legend" variant="subtitle2" color="textPrimary">
        {legend}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
        {swatches.map(option => {
          const isChecked = sameColor(value, option.value)
          return (
            <Box
              key={option.value}
              component="label"
              title={option.label}
              sx={theme => ({
                position: 'relative',
                width: SIZE,
                height: SIZE,
                flexShrink: 0,
                borderRadius: '50%',
                cursor: 'pointer',
                backgroundColor: option.value,
                border: `1px solid ${theme.vars.palette.divider}`,
                boxShadow: isChecked
                  ? `0 0 0 2px ${theme.vars.palette.background.paper}, 0 0 0 4px ${theme.vars.palette.text.primary}`
                  : 'none',
                // The input is hidden: the outline goes around the swatch
                '&:has(input:focus-visible)': {
                  ...FOCUS_RING,
                  '--focus-ring-offset': '4px'
                }
              })}
            >
              <Box
                component="input"
                type="radio"
                name={name}
                value={option.value}
                checked={isChecked}
                onChange={handleChange}
                aria-label={option.label}
                data-color={option.value}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  m: 0,
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
