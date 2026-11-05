// Upstream to twake-ui: yes. A colour field: a square showing the colour
// chosen, opening twake-mui's `ColorList` look (21 px circles in rows of 7)
// in a popover, with "no colour" first and a free colour last, as a radio
// group. twake-mui's `ColorList` has neither and its swatches are buttons.
import { Box, IconButton, Popover, Tooltip } from '@linagora/twake-mui'
import { Check, Cross, Icon, Palette } from '@linagora/twake-icons'
import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode
} from 'react'

import { FOCUS_RING } from '@/ds/FocusIndicator/focusIndicator'
import {
  sameColor,
  type ColorSwatch
} from '@/ds/ColorSwatchPicker/ColorSwatchPicker'

export interface ColorPopoverPickerProps {
  /** Accessible name and tooltip of the button, saying the colour chosen */
  buttonLabel: string
  /** Name of the group of colours */
  groupLabel: string
  swatches: readonly ColorSwatch[]
  /** The colour chosen, null for none */
  value: string | null
  /** Name of the "no colour" choice, null not to offer it */
  noneLabel: string | null
  /** Name of the free colour choice */
  customLabel: string
  /** The free colour is chosen (its value is typed elsewhere) */
  isCustom: boolean
  onChange: (value: string | null) => void
  onCustom: () => void
  'data-testid'?: string
}

const SIZE = 21
const ICON = 10
const GAP = 5
const COLUMNS = 7
const NONE = ''
const CUSTOM = 'custom'

// Not `instanceof`: the popover may be rendered in another document
function inputOf(target: EventTarget): HTMLInputElement | null {
  return (target as Element).tagName === 'INPUT'
    ? (target as HTMLInputElement)
    : null
}

function NoneMark(): ReactElement {
  return (
    <Box
      component="span"
      sx={theme => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        bgcolor: 'background.paper',
        border: `1px solid ${theme.vars.palette.divider}`,
        color: 'text.secondary'
      })}
    >
      <Icon icon={Cross} size={ICON} aria-hidden="true" />
    </Box>
  )
}

interface SwatchProps {
  name: string
  value: string
  label: string
  isChecked: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  background: string | null
  children?: ReactNode
}

function Swatch({
  name,
  value,
  label,
  isChecked,
  onChange,
  background,
  children
}: SwatchProps): ReactElement {
  return (
    <Box
      component="label"
      title={label}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        cursor: 'pointer',
        color: 'common.white',
        ...(background === null ? {} : { backgroundColor: background }),
        // The input is hidden: the outline goes around the swatch
        '&:has(input:focus-visible)': {
          ...FOCUS_RING,
          '--focus-ring-offset': '2px'
        }
      }}
    >
      {children}
      {isChecked && background !== null ? (
        <Icon icon={Check} size={ICON} aria-hidden="true" />
      ) : null}
      <Box
        component="input"
        type="radio"
        name={name}
        value={value}
        checked={isChecked}
        onChange={onChange}
        aria-label={label}
        data-color={value}
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
}

const CUSTOM_RING = {
  border: '1px solid transparent',
  backgroundImage:
    'linear-gradient(var(--twake-palette-background-paper), var(--twake-palette-background-paper)), conic-gradient(from 0deg, #FB2C36, #AD46FF, #2B7FFF, #FB2C36)',
  backgroundOrigin: 'border-box',
  backgroundClip: 'padding-box, border-box',
  color: 'text.primary'
}

/**
 * A square button showing the colour chosen; it opens the colours as a
 * radio group. The arrows move the choice and apply it; a click, Enter or
 * Space applies it and closes; Escape closes and gives the focus back.
 */
export function ColorPopoverPicker({
  buttonLabel,
  groupLabel,
  swatches,
  value,
  noneLabel,
  customLabel,
  isCustom,
  onChange,
  onCustom,
  'data-testid': testId
}: ColorPopoverPickerProps): ReactElement {
  const name = useId()
  const popoverId = useId()
  const groupRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const isOpen = anchor !== null
  const selected = isCustom ? CUSTOM : (value ?? NONE)

  const close = (): void => {
    setAnchor(null)
  }
  const pick = (picked: string): void => {
    if (picked === CUSTOM) onCustom()
    else onChange(picked === NONE ? null : picked)
  }
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    pick(event.target.value)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const input = inputOf(event.target)
    if (event.key === 'Enter' && input !== null) {
      event.preventDefault()
      pick(input.value)
      close()
    }
  }
  // Space checks the radio on its release
  const handleKeyUp = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === ' ' && inputOf(event.target) !== null) close()
  }
  // A keyboard "click" (arrows in the group) has no detail: keep it open
  const handleClick = (event: MouseEvent<HTMLElement>): void => {
    if (event.detail > 0 && inputOf(event.target)?.type === 'radio') close()
  }

  return (
    <>
      <Tooltip title={buttonLabel}>
        <IconButton
          aria-label={buttonLabel}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? popoverId : undefined}
          onClick={event => {
            setAnchor(event.currentTarget)
          }}
          data-testid={testId}
          sx={theme => ({
            width: 47,
            height: 47,
            flexShrink: 0,
            borderRadius: '4px',
            border: `1px solid ${theme.vars.palette.border.main}`
          })}
        >
          {value === null ? (
            <NoneMark />
          ) : (
            <Box
              component="span"
              sx={{
                width: SIZE,
                height: SIZE,
                borderRadius: '50%',
                bgcolor: value
              }}
            />
          )}
        </IconButton>
      </Tooltip>
      <Popover
        id={popoverId}
        open={isOpen}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': groupLabel,
            elevation: 3,
            sx: { ml: 1.5, borderRadius: '16px' }
          },
          transition: {
            onEntered: () => {
              const inputs = Array.from(
                groupRef.current?.querySelectorAll('input') ?? []
              )
              ;(inputs.find(input => input.checked) ?? inputs[0])?.focus()
            }
          }
        }}
      >
        <Box
          ref={groupRef}
          role="radiogroup"
          aria-label={groupLabel}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onClick={handleClick}
          data-testid={testId === undefined ? undefined : `${testId}-popover`}
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${String(COLUMNS)}, ${String(SIZE)}px)`,
            gap: `${String(GAP - 1)}px ${String(GAP)}px`,
            p: 2,
            width: 213,
            boxSizing: 'border-box',
            justifyContent: 'center'
          }}
        >
          {noneLabel === null ? null : (
            <Swatch
              name={name}
              value={NONE}
              label={noneLabel}
              isChecked={selected === NONE}
              onChange={handleChange}
              background={null}
            >
              <NoneMark />
            </Swatch>
          )}
          {swatches.map(swatch => (
            <Swatch
              key={swatch.value}
              name={name}
              value={swatch.value}
              label={swatch.label}
              isChecked={!isCustom && sameColor(value, swatch.value)}
              onChange={handleChange}
              background={swatch.value}
            />
          ))}
          <Swatch
            name={name}
            value={CUSTOM}
            label={customLabel}
            isChecked={isCustom}
            onChange={handleChange}
            background={null}
          >
            <Box
              component="span"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: SIZE,
                height: SIZE,
                borderRadius: '50%',
                boxSizing: 'border-box',
                ...CUSTOM_RING
              }}
            >
              <Icon
                icon={isCustom ? Check : Palette}
                size={ICON}
                aria-hidden="true"
              />
            </Box>
          </Swatch>
        </Box>
      </Popover>
    </>
  )
}
