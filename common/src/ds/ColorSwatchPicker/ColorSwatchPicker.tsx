// Upstream to twake-ui: yes. Picking a colour among swatches (labels,
// calendars, tags) is common to Twake apps; twake-mui has no colour input.
import { Box, Typography } from '@linagora/twake-mui'
import { useId, type ChangeEvent, type ReactElement } from 'react'

export interface ColorSwatch {
  /** `#RRGGBB` */
  value: string
  /** Accessible name, e.g. "Color #273891" */
  label: string
}

export interface ColorSwatchPickerProps {
  /** Visible name of the group */
  legend: string
  swatches: readonly ColorSwatch[]
  /** The colour chosen, null for none */
  value: string | null
  onChange: (value: string | null) => void
  /** Name of the "no colour" choice; without it, a colour is required */
  noneLabel?: string
  'data-testid'?: string
}

const SIZE = 28

/**
 * Colour swatches as a native radio group: arrows move the choice, the
 * focus ring and the selected ring are visible, each swatch has a name.
 */
export function ColorSwatchPicker({
  legend,
  swatches,
  value,
  onChange,
  noneLabel,
  'data-testid': testId
}: ColorSwatchPickerProps): ReactElement {
  const name = useId()
  const options = [
    ...(noneLabel === undefined ? [] : [{ value: '', label: noneLabel }]),
    ...swatches
  ]

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.value === '' ? null : event.target.value)
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
        {options.map(option => {
          const isChecked = (value ?? '') === option.value
          return (
            <Box
              key={option.value || 'none'}
              component="label"
              title={option.label}
              sx={theme => ({
                position: 'relative',
                width: SIZE,
                height: SIZE,
                borderRadius: '50%',
                cursor: 'pointer',
                backgroundColor: option.value || theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: isChecked
                  ? `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.text.primary}`
                  : 'none',
                // "No colour": a diagonal stroke
                backgroundImage:
                  option.value === ''
                    ? `linear-gradient(135deg, transparent 45%, ${theme.palette.error.main} 45%, ${theme.palette.error.main} 55%, transparent 55%)`
                    : 'none',
                '&:has(input:focus-visible)': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 4
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
                data-color={option.value || 'none'}
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
