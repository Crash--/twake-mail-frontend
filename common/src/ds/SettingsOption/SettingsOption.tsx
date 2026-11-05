// Upstream to twake-ui: no. The options of the settings, as the Figma's
// Preferences: groups under a `body2` heading, one row per option (its label
// in `body1`, what it does in `caption` `text.secondary`, twake-mui's
// `Switch` at the end), 24 px between two groups.
import {
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  Switch,
  Typography
} from '@linagora/twake-mui'
import {
  useId,
  type ChangeEvent,
  type ReactElement,
  type ReactNode
} from 'react'

const SECTION_SX = { mb: 3, '&:last-child': { mb: 0 } } as const

const TITLE_SX = {
  m: 0,
  typography: 'body2',
  color: 'text.primary'
} as const

const GROUP_TITLE_SX = { ...TITLE_SX, mb: 0.5 } as const

const DESCRIPTION_SX = {
  mt: 0.5,
  mb: 1,
  typography: 'caption',
  color: 'text.secondary'
} as const

const ROW_SX = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 2,
  pt: 1,
  pb: 2
} as const

const ROW_TITLE_SX = {
  display: 'block',
  typography: 'body1',
  color: 'text.primary',
  cursor: 'pointer'
} as const

const ROW_DESCRIPTION_SX = {
  mt: 1,
  mb: 0,
  typography: 'body1',
  color: 'text.secondary'
} as const

export interface SettingsSwitchRowProps {
  title: string
  description?: string
  isChecked: boolean
  isDisabled?: boolean
  onChange: (isChecked: boolean) => void
  /** The switch at the end of a row this wide at most, instead of first */
  endWidth?: number
  /** On the switch */
  'data-testid'?: string
}

/**
 * A switch with its title and what it does after it, as tmail-flutter's
 * "Keep a copy in Inbox": the title names the switch, the text describes it
 */
export function SettingsSwitchRow({
  title,
  description,
  isChecked,
  isDisabled = false,
  onChange,
  endWidth,
  'data-testid': testId
}: SettingsSwitchRowProps): ReactElement {
  const switchId = useId()
  const descriptionId = useId()

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.checked)
  }

  return (
    <Box
      sx={
        endWidth === undefined
          ? ROW_SX
          : {
              ...ROW_SX,
              flexDirection: 'row-reverse',
              justifyContent: 'space-between',
              alignItems: 'center',
              maxWidth: endWidth,
              py: 1
            }
      }
    >
      <Switch
        id={switchId}
        checked={isChecked}
        disabled={isDisabled}
        onChange={handleChange}
        disableRipple
        sx={{ flexShrink: 0 }}
        slotProps={{
          input: {
            'aria-describedby':
              description === undefined ? undefined : descriptionId
          }
        }}
        data-testid={testId}
      />
      <Box>
        <Box
          component="label"
          htmlFor={switchId}
          // Faded with its switch
          sx={
            isDisabled
              ? { ...ROW_TITLE_SX, color: 'text.disabled', cursor: 'default' }
              : ROW_TITLE_SX
          }
        >
          {title}
        </Box>
        {description === undefined ? null : (
          <Typography id={descriptionId} component="p" sx={ROW_DESCRIPTION_SX}>
            {description}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export interface SettingsOptionGroupProps {
  title: string
  children: ReactNode
}

/** A few options under their heading (an `h2`) */
export function SettingsOptionGroup({
  title,
  children
}: SettingsOptionGroupProps): ReactElement {
  const titleId = useId()
  return (
    <Box component="section" aria-labelledby={titleId} sx={SECTION_SX}>
      <Typography id={titleId} component="h2" sx={GROUP_TITLE_SX}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

export interface SettingsOptionProps {
  /** Label of the switch, e.g. "Enable thread" */
  toggleLabel: string
  description: string
  isChecked: boolean
  isDisabled?: boolean
  onChange: (isChecked: boolean) => void
  /**
   * What the choice made costs, under the text in orange, null for none;
   * announced when it appears, and describing the switch
   */
  warning?: string | null
  /** On the switch */
  'data-testid'?: string
}

/**
 * An option of the settings, one row: the label of the switch and what it
 * does, the switch at the end, named by the label and described by the text
 * (and by its warning)
 */
export function SettingsOption({
  toggleLabel,
  description,
  isChecked,
  isDisabled = false,
  onChange,
  warning = null,
  'data-testid': testId
}: SettingsOptionProps): ReactElement {
  const switchId = useId()
  const descriptionId = useId()
  const warningId = useId()

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.checked)
  }

  return (
    <Box sx={OPTION_SX}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          component="label"
          htmlFor={switchId}
          sx={
            isDisabled
              ? { ...ROW_TITLE_SX, color: 'text.disabled', cursor: 'default' }
              : ROW_TITLE_SX
          }
        >
          {toggleLabel}
        </Box>
        <Typography id={descriptionId} component="p" sx={OPTION_DESCRIPTION_SX}>
          {description}
        </Typography>
        {/* Kept in the page, so that the warning is announced as it appears */}
        <Box role="status">
          {warning === null ? null : (
            <Typography id={warningId} component="p" sx={WARNING_SX}>
              {warning}
            </Typography>
          )}
        </Box>
      </Box>
      <Switch
        id={switchId}
        checked={isChecked}
        disabled={isDisabled}
        onChange={handleChange}
        disableRipple
        sx={{ flexShrink: 0 }}
        slotProps={{
          input: {
            'aria-describedby': [
              descriptionId,
              ...(warning === null ? [] : [warningId])
            ].join(' ')
          }
        }}
        data-testid={testId}
      />
    </Box>
  )
}

const OPTION_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  maxWidth: 628,
  py: '12px'
} as const

const OPTION_DESCRIPTION_SX = {
  mt: '2px',
  mb: 0,
  typography: 'caption',
  color: 'text.secondary'
} as const

const WARNING_SX = {
  mt: 0.5,
  mb: 0,
  typography: 'caption',
  color: 'warning.main'
} as const

const CHOICES_SX = { gap: '4px' } as const

// Each choice as the label of a switch
const CHOICE_SX = {
  m: 0,
  gap: '12px',
  '& .MuiFormControlLabel-label': {
    typography: 'body1',
    color: 'text.primary'
  },
  '& .MuiRadio-root': { p: '2px' }
} as const

export interface SettingsChoiceOptionProps<Value extends string> {
  title: string
  description: string
  value: Value
  choices: readonly { value: Value; label: string }[]
  isDisabled?: boolean
  onChange: (value: Value) => void
  /** On the group of choices; each radio takes `<id>-<value>` */
  'data-testid'?: string
}

/**
 * An option of the settings with a choice among a few values: its title
 * (an `h2`), what it does, then one radio per value, as `SettingsOption`
 * with its switch. The group is named by the title and described by the text
 */
export function SettingsChoiceOption<Value extends string>({
  title,
  description,
  value,
  choices,
  isDisabled = false,
  onChange,
  'data-testid': testId
}: SettingsChoiceOptionProps<Value>): ReactElement {
  const titleId = useId()
  const descriptionId = useId()

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const picked = choices.find(choice => choice.value === event.target.value)
    if (picked !== undefined) onChange(picked.value)
  }

  return (
    <Box component="section" aria-labelledby={titleId} sx={SECTION_SX}>
      <Typography id={titleId} component="h2" sx={TITLE_SX}>
        {title}
      </Typography>
      <Typography id={descriptionId} component="p" sx={DESCRIPTION_SX}>
        {description}
      </Typography>
      <RadioGroup
        value={value}
        onChange={handleChange}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        sx={CHOICES_SX}
        data-testid={testId}
      >
        {choices.map(choice => (
          <FormControlLabel
            key={choice.value}
            value={choice.value}
            label={choice.label}
            disabled={isDisabled}
            sx={CHOICE_SX}
            control={
              <Radio
                disableRipple
                slotProps={{
                  input: {
                    'data-testid':
                      testId === undefined
                        ? undefined
                        : `${testId}-${choice.value}`
                  } as Record<string, string | undefined>
                }}
              />
            }
          />
        ))}
      </RadioGroup>
    </Box>
  )
}
