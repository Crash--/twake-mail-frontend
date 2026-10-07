// Upstream to twake-ui: yes. Picking a colour among swatches (labels,
// calendars, tags) is common to Twake apps; twake-mui has no colour input.
import { Box, TextField, Typography } from '@linagora/twake-mui'
import {
  useId,
  useState,
  type ChangeEvent,
  type ReactElement,
  type Ref
} from 'react'

import { FOCUS_RING } from '@/ds/FocusIndicator/focusIndicator'
import { VISUALLY_HIDDEN } from '@/ds/MessageAlert/visuallyHidden'

import { normalizeHexColor } from './hexColor'

export interface ColorSwatch {
  /** `#RRGGBB` */
  value: string
  /** Accessible name, e.g. "Navy blue" */
  label: string
}

/** The "custom colour" swatch, and the fields it opens */
export interface CustomColor {
  /** Name of the swatch, e.g. "Custom colour" */
  label: string
  /** Name of the swatch once it holds a colour, e.g. "Custom colour #1A2B3C" */
  valueLabel: (value: string) => string
  /** Visible name of the hexadecimal field */
  hexLabel: string
  /** Help of the hexadecimal field, e.g. "Format #RRGGBB" */
  hint: string
  /** Error of the hexadecimal field */
  invalidMessage: string
  /** Name of the native colour input */
  pickerLabel: string
  /** Shows the error of an untouched field (a submit was attempted) */
  showError?: boolean
  /** Told whether the custom field holds a colour (always true off custom) */
  onValidityChange?: (isValid: boolean) => void
  /** To move the focus to the hexadecimal field */
  hexInputRef?: Ref<HTMLInputElement>
  testIds?: { swatch?: string; hexInput?: string; nativeInput?: string }
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
  /**
   * A last swatch for any colour: a hexadecimal field (typed or pasted, the
   * accessible way) and the native colour input (the system picker, handy on
   * a phone). `onChange` only receives a valid `#RRGGBB`.
   */
  custom?: CustomColor
  'data-testid'?: string
}

const SIZE = 28
const CUSTOM = 'custom'
const DEFAULT_CUSTOM = '#2196F3'
const RAINBOW =
  'conic-gradient(#ED20A4, #EDA91D, #51B588, #4896E5, #7E57E3, #ED20A4)'

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
  noneLabel,
  custom,
  'data-testid': testId
}: ColorSwatchPickerProps): ReactElement {
  const name = useId()
  // A colour out of the swatches is a custom one
  const [isCustom, setIsCustom] = useState(
    custom !== undefined &&
      value !== null &&
      !swatches.some(swatch => sameColor(value, swatch.value))
  )
  const [draft, setDraft] = useState(
    value === null ? '' : (normalizeHexColor(value) ?? value)
  )
  const [isTouched, setIsTouched] = useState(false)
  const draftColor = normalizeHexColor(draft)
  const isInvalid = isCustom && draftColor === null
  const showError = isInvalid && (isTouched || custom?.showError === true)
  const customLabel =
    custom === undefined
      ? ''
      : isCustom && draftColor !== null
        ? custom.valueLabel(draftColor)
        : custom.label
  const options = [
    ...(noneLabel === undefined ? [] : [{ value: '', label: noneLabel }]),
    ...swatches,
    ...(custom === undefined ? [] : [{ value: CUSTOM, label: customLabel }])
  ]

  const applyDraft = (text: string): void => {
    setDraft(text)
    const color = normalizeHexColor(text)
    custom?.onValidityChange?.(color !== null)
    if (color !== null) onChange(color)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    if (event.target.value === CUSTOM) {
      setIsCustom(true)
      applyDraft(draftColor ?? value ?? DEFAULT_CUSTOM)
      return
    }
    setIsCustom(false)
    custom?.onValidityChange?.(true)
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
          const isChecked =
            option.value === CUSTOM
              ? isCustom
              : !isCustom &&
                (option.value === ''
                  ? value === null
                  : sameColor(value, option.value))
          const background =
            option.value === CUSTOM
              ? isCustom && draftColor !== null
                ? draftColor
                : null
              : option.value
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
                backgroundColor: background ?? theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: isChecked
                  ? `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.text.primary}`
                  : 'none',
                // "No colour": a diagonal stroke
                backgroundImage:
                  option.value === ''
                    ? `linear-gradient(135deg, transparent 45%, ${theme.palette.error.main} 45%, ${theme.palette.error.main} 55%, transparent 55%)`
                    : option.value === CUSTOM && background === null
                      ? RAINBOW
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
                data-color={
                  option.value === CUSTOM
                    ? (draftColor ?? CUSTOM)
                    : option.value || 'none'
                }
                data-testid={
                  option.value === CUSTOM ? custom?.testIds?.swatch : undefined
                }
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
      {custom !== undefined && isCustom ? (
        <Box
          sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mt: 2 }}
        >
          <TextField
            size="small"
            label={custom.hexLabel}
            value={draft}
            onChange={event => {
              applyDraft(event.target.value)
            }}
            onBlur={() => {
              setIsTouched(true)
              if (draftColor !== null) setDraft(draftColor)
            }}
            inputRef={custom.hexInputRef}
            error={showError}
            helperText={showError ? custom.invalidMessage : custom.hint}
            slotProps={{
              htmlInput: {
                maxLength: 7,
                autoComplete: 'off',
                autoCapitalize: 'characters',
                spellCheck: false,
                'data-testid': custom.testIds?.hexInput
              },
              formHelperText: showError ? { role: 'alert' } : undefined
            }}
            sx={{ flex: 1, minWidth: 0, maxWidth: 280 }}
          />
          <Box
            component="input"
            type="color"
            value={draftColor?.toLowerCase() ?? DEFAULT_CUSTOM.toLowerCase()}
            onChange={event => {
              // The native input answers in lower case
              applyDraft(
                normalizeHexColor(event.target.value) ?? event.target.value
              )
            }}
            aria-label={custom.pickerLabel}
            title={custom.pickerLabel}
            data-testid={custom.testIds?.nativeInput}
            sx={{
              width: 40,
              height: 40,
              p: 0.5,
              cursor: 'pointer',
              bgcolor: 'transparent',
              border: theme => `1px solid ${theme.palette.divider}`,
              borderRadius: 1
            }}
          />
          <Box role="status" sx={VISUALLY_HIDDEN}>
            {draftColor === null ? '' : custom.valueLabel(draftColor)}
          </Box>
        </Box>
      ) : null}
    </Box>
  )
}
