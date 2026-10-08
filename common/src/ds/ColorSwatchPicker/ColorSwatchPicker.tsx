// Upstream to twake-ui: yes. Picking a colour among swatches (labels,
// calendars, tags) is common to Twake apps; twake-mui has no colour input.
import { Icon } from '@linagora/twake-icons'
import { Box, TextField, Typography } from '@linagora/twake-mui'
import {
  useId,
  useState,
  type ChangeEvent,
  type ReactElement,
  type Ref
} from 'react'

import { Check, CloseDialog, Palette } from '@/ds/FlutterIcons/FlutterIcons'
import { FOCUS_RING } from '@/ds/FocusIndicator/focusIndicator'
import { VISUALLY_HIDDEN } from '@/ds/MessageAlert/visuallyHidden'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

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
  /**
   * tmail-flutter's swatches of a label (`ColorsMapWidget`): 40 px discs 10
   * px apart, a white tick on the chosen one, "no colour" a grey ring with a
   * cross, the custom one a gradient ring with a palette
   */
  isLarge?: boolean
  'data-testid'?: string
}

const SIZE = 28
const LARGE_SIZE = 40

const LARGE_LEGEND_SX = {
  mb: '16px',
  p: 0,
  fontSize: 14,
  fontWeight: 600,
  lineHeight: '18px',
  color: '#000000'
} as const

/** The custom swatch of tmail-flutter: a white disc in a gradient ring */
const GRADIENT_RING =
  'linear-gradient(#FFFFFF, #FFFFFF) padding-box, linear-gradient(135deg, #FB2C36, #AD46FF, #2B7FFF) border-box'

function largeSwatchSx(
  value: string,
  background: string | null
): Record<string, unknown> {
  return value === CUSTOM && background === null
    ? { border: '2px solid transparent', boxSizing: 'border-box' }
    : { boxSizing: 'border-box' }
}

function largeBackgroundImage(
  value: string,
  background: string | null
): string {
  return value === CUSTOM && background === null ? GRADIENT_RING : 'none'
}

/** What a large swatch draws in its middle */
function LargeSwatchMark({
  kind
}: {
  kind: 'none' | 'custom' | 'checked' | 'plain'
}): ReactElement | null {
  if (kind === 'plain') return null
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        color:
          kind === 'checked'
            ? '#FFFFFF'
            : kind === 'none'
              ? 'rgba(28, 27, 31, 0.48)'
              : '#1C1B1F'
      }}
    >
      <Icon
        icon={
          kind === 'checked' ? Check : kind === 'none' ? CloseDialog : Palette
        }
        size={kind === 'checked' ? 20 : 18}
      />
    </Box>
  )
}
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
  isLarge = false,
  'data-testid': testId
}: ColorSwatchPickerProps): ReactElement {
  const isPhone = useScreenSize() === 'mobile'
  const size = isLarge ? LARGE_SIZE : SIZE
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
      <Typography
        component="legend"
        variant="subtitle2"
        color="textPrimary"
        sx={isLarge ? LARGE_LEGEND_SX : undefined}
      >
        {legend}
      </Typography>
      <Box
        sx={
          isLarge
            ? {
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                pl: isPhone ? 0 : '32px',
                pr: isPhone ? 0 : '16px'
              }
            : { display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }
        }
      >
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
                width: size,
                height: size,
                flexShrink: 0,
                borderRadius: '50%',
                cursor: 'pointer',
                backgroundColor:
                  background ?? theme.vars.palette.background.paper,
                ...(isLarge ? largeSwatchSx(option.value, background) : {}),
                border: isLarge
                  ? option.value === ''
                    ? '2px solid #CDCDCD'
                    : option.value === CUSTOM && background === null
                      ? '2px solid transparent'
                      : 'none'
                  : `1px solid ${theme.vars.palette.divider}`,
                boxShadow: isLarge
                  ? 'none'
                  : isChecked
                    ? `0 0 0 2px ${theme.vars.palette.background.paper}, 0 0 0 4px ${theme.vars.palette.text.primary}`
                    : 'none',
                // "No colour": a diagonal stroke
                backgroundImage: isLarge
                  ? largeBackgroundImage(option.value, background)
                  : option.value === ''
                    ? `linear-gradient(135deg, transparent 45%, ${theme.vars.palette.error.main} 45%, ${theme.vars.palette.error.main} 55%, transparent 55%)`
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
              {isLarge ? (
                <LargeSwatchMark
                  kind={
                    option.value === ''
                      ? 'none'
                      : option.value === CUSTOM && background === null
                        ? 'custom'
                        : isChecked
                          ? 'checked'
                          : 'plain'
                  }
                />
              ) : null}
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
              border: theme => `1px solid ${theme.vars.palette.divider}`,
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
