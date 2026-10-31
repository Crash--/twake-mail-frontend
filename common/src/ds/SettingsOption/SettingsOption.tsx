// Upstream to twake-ui: no. The options of the settings: the title
// (`subtitle2`), what it does in `body1` `text.secondary` around it, then
// twake-mui's `Switch` and its label; a margin between two options.
import {
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  Switch,
  Typography
} from '@linagora/twake-mui'
import { useId, type ChangeEvent, type ReactElement } from 'react'

const SECTION_SX = { mb: 3, '&:last-child': { mb: 0 } } as const

const TITLE_SX = {
  m: 0,
  typography: 'subtitle2',
  color: 'text.primary'
} as const

const DESCRIPTION_SX = {
  my: 0.5,
  typography: 'body1',
  color: 'text.secondary'
} as const

const LABEL_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: 'fit-content',
  cursor: 'pointer',
  typography: 'body1',
  color: 'text.primary'
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
  'data-testid': testId
}: SettingsSwitchRowProps): ReactElement {
  const switchId = useId()
  const descriptionId = useId()

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.checked)
  }

  return (
    <Box sx={ROW_SX}>
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

export interface SettingsOptionProps {
  title: string
  description: string
  /** Label of the switch, e.g. "Enable thread" */
  toggleLabel: string
  isChecked: boolean
  isDisabled?: boolean
  onChange: (isChecked: boolean) => void
  /**
   * What the choice made costs, under the switch in orange, null for none;
   * announced when it appears, and describing the switch
   */
  warning?: string | null
  /** On the switch */
  'data-testid'?: string
}

/**
 * An option of the settings: its title (an `h2`), what it does, and the
 * switch, named by its label and described by both (and by its warning)
 */
export function SettingsOption({
  title,
  description,
  toggleLabel,
  isChecked,
  isDisabled = false,
  onChange,
  warning = null,
  'data-testid': testId
}: SettingsOptionProps): ReactElement {
  const titleId = useId()
  const descriptionId = useId()
  const warningId = useId()

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.checked)
  }

  return (
    <Box component="section" aria-labelledby={titleId} sx={SECTION_SX}>
      <Typography id={titleId} component="h2" sx={TITLE_SX}>
        {title}
      </Typography>
      <Typography id={descriptionId} component="p" sx={DESCRIPTION_SX}>
        {description}
      </Typography>
      <Box component="label" sx={LABEL_SX}>
        <Switch
          checked={isChecked}
          disabled={isDisabled}
          onChange={handleChange}
          disableRipple
          slotProps={{
            input: {
              'aria-describedby': [
                titleId,
                descriptionId,
                ...(warning === null ? [] : [warningId])
              ].join(' ')
            }
          }}
          data-testid={testId}
        />
        {toggleLabel}
      </Box>
      {/* Kept in the page, so that the warning is announced as it appears */}
      <Box role="status">
        {warning === null ? null : (
          <Typography id={warningId} component="p" sx={WARNING_SX}>
            {warning}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

// A one line warning under the switch, in the orange of the theme's warning
const WARNING_SX = {
  mt: '8px',
  mb: 0,
  typography: 'body1',
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
