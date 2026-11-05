// Upstream to twake-ui: yes. A segmented control (the Figma's "Right away" /
// "Pick a time"): a grey pill holding one pill per choice, the chosen one
// white, raised, in `primary.main`. twake-mui has no `ToggleButtonGroup`
// look of this kind; native radios keep the arrows and the form semantics.
import { Box } from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

import { FOCUS_RING } from '@/ds/FocusIndicator/focusIndicator'

const GROUP_SX = {
  display: 'inline-flex',
  p: '2px',
  borderRadius: '20px',
  bgcolor: 'action.hover'
} as const

const CHOICE_SX = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 32,
  px: 2,
  borderRadius: '16px',
  typography: 'body2',
  color: 'text.secondary',
  cursor: 'pointer',
  '&:has(input:focus-visible)': FOCUS_RING
} as const

const CHOSEN_SX = {
  ...CHOICE_SX,
  bgcolor: 'background.paper',
  color: 'primary.main',
  boxShadow: 1
} as const

const DISABLED_SX = { opacity: 0.5, cursor: 'default' } as const

export interface SegmentedChoiceProps<Value extends string> {
  /** Id of the element naming the group, e.g. the "Starts:" label */
  labelledBy: string
  value: Value
  choices: readonly { value: Value; label: string }[]
  isDisabled?: boolean
  onChange: (value: Value) => void
  /** On the group; each radio takes `<id>-<value>` */
  'data-testid'?: string
}

/** One choice among a few, as pills side by side (a radio group) */
export function SegmentedChoice<Value extends string>({
  labelledBy,
  value,
  choices,
  isDisabled = false,
  onChange,
  'data-testid': testId
}: SegmentedChoiceProps<Value>): ReactElement {
  const name = useId()
  return (
    <Box
      role="radiogroup"
      aria-labelledby={labelledBy}
      sx={isDisabled ? { ...GROUP_SX, ...DISABLED_SX } : GROUP_SX}
      data-testid={testId}
    >
      {choices.map(choice => (
        <Box
          key={choice.value}
          component="label"
          sx={
            choice.value === value
              ? CHOSEN_SX
              : isDisabled
                ? { ...CHOICE_SX, cursor: 'default' }
                : CHOICE_SX
          }
        >
          <input
            type="radio"
            className="u-visuallyhidden"
            name={name}
            value={choice.value}
            checked={choice.value === value}
            disabled={isDisabled}
            onChange={() => {
              onChange(choice.value)
            }}
            data-testid={
              testId === undefined ? undefined : `${testId}-${choice.value}`
            }
          />
          {choice.label}
        </Box>
      ))}
    </Box>
  )
}
