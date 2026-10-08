// Upstream to twake-ui: no, the look of tmail-flutter's options of the
// settings (`PreferencesOptionItem`): the title in Semi Bold 14 dark grey,
// what it does in Regular 14/21 grey (#424244 at 64 %) 12 px around it,
// then the 44 × 28 blue switch and its label in Regular 15 black, 12 px
// apart; 49 px between two options.
import { Box, Switch, Typography } from '@linagora/twake-mui'
import { useId, type ChangeEvent, type ReactElement } from 'react'

const SECTION_SX = { mb: '49px', '&:last-child': { mb: 0 } } as const

const TITLE_SX = {
  m: 0,
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 600,
  letterSpacing: '0.25px',
  color: '#424244'
} as const

const DESCRIPTION_SX = {
  my: '12px',
  fontSize: 14,
  lineHeight: '21px',
  fontWeight: 400,
  letterSpacing: '-0.15px',
  color: 'rgba(66, 66, 68, 0.64)'
} as const

const LABEL_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: 'fit-content',
  cursor: 'pointer',
  fontSize: 15,
  lineHeight: '20px',
  fontWeight: 400,
  color: '#000000'
} as const

// tmail-flutter's switch (`DefaultSwitchIconWidget`): 44 × 28, a 24 px white
// thumb on blue when on, on grey when off
const SWITCH_SX = {
  width: 44,
  height: 28,
  p: 0,
  '& .MuiSwitch-switchBase': {
    top: 0,
    left: 0,
    p: '2px',
    color: '#FFFFFF',
    '&.Mui-checked': {
      transform: 'translateX(16px)',
      color: '#FFFFFF',
      '& + .MuiSwitch-track': { bgcolor: '#007AFF', opacity: 1 }
    },
    '&.Mui-disabled + .MuiSwitch-track': { opacity: 0.38 }
  },
  // twake-mui draws the thumb in its own `switchThumb` (20 px)
  '&& .MuiSwitch-thumb, && .switchThumb': {
    width: 24,
    height: 24,
    m: 0,
    boxShadow: 'none'
  },
  '& .MuiSwitch-track': {
    borderRadius: '14px',
    bgcolor: '#D3D3D3',
    opacity: 1
  }
} as const

const ROW_SX = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 2,
  pt: 1,
  pb: 2
} as const

/** The text of what is disabled, as tmail-flutter fades it */
const DISABLED_TEXT = 'rgba(66, 66, 68, 0.38)'

const ROW_TITLE_SX = {
  display: 'block',
  fontSize: 15,
  lineHeight: '20px',
  color: '#000000',
  cursor: 'pointer'
} as const

const ROW_DESCRIPTION_SX = {
  mt: 1,
  mb: 0,
  fontSize: 15,
  lineHeight: '20px',
  color: 'rgba(66, 66, 68, 0.64)'
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
        sx={{ ...SWITCH_SX, flexShrink: 0, mt: '-4px' }}
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
          // As tmail-flutter: faded with its switch
          sx={
            isDisabled
              ? { ...ROW_TITLE_SX, color: DISABLED_TEXT, cursor: 'default' }
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
  /** On the switch */
  'data-testid'?: string
}

/**
 * An option of the settings: its title (an `h2`), what it does, and the
 * switch, named by its label and described by both
 */
export function SettingsOption({
  title,
  description,
  toggleLabel,
  isChecked,
  isDisabled = false,
  onChange,
  'data-testid': testId
}: SettingsOptionProps): ReactElement {
  const titleId = useId()
  const descriptionId = useId()

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
          sx={SWITCH_SX}
          slotProps={{
            input: { 'aria-describedby': `${titleId} ${descriptionId}` }
          }}
          data-testid={testId}
        />
        {toggleLabel}
      </Box>
    </Box>
  )
}
