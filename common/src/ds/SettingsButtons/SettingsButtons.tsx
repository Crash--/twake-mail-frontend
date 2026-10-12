// Upstream to twake-ui: no, the buttons of tmail-flutter's settings. The
// main action of a section ("Create new identity", "Add rule"): a 48 px blue
// pill, a 16 px icon 8 px before the label in Medium 14 white, 32 px on the
// sides; a secondary one, its label in blue only. The action of a row ("Edit", "Delete"): a 20 px blue icon and the
// label in Medium 13 blue, no background, at least 100 px wide.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { ButtonBase, Tooltip } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

const PRIMARY_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1,
  flexShrink: 0,
  height: 48,
  maxWidth: 300,
  px: 4,
  borderRadius: '100px',
  // tmail-flutter's `primaryMain`
  bgcolor: '#0A84FF',
  color: '#FFFFFF',
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  letterSpacing: '0.1px',
  whiteSpace: 'nowrap',
  '&:hover': { bgcolor: 'primary.dark' },
  '&.Mui-disabled': { opacity: 0.38 }
} as const

const ROW_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  minWidth: 100,
  px: 1,
  py: '5px',
  borderRadius: '8px',
  color: 'primary.main',
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  letterSpacing: '0.39px',
  whiteSpace: 'nowrap',
  '&:hover': { bgcolor: TMAIL.blueHover }
} as const

export interface SettingsPrimaryButtonProps {
  label: string
  /** Before the label, if any */
  icon?: IconProps['icon']
  /** Not needed for the submit button of a form */
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  /** As wide as its container, e.g. under a field on a phone */
  isFullWidth?: boolean
  'data-testid'?: string
}

/** The main action of a settings section, beside its title */
export function SettingsPrimaryButton({
  label,
  icon,
  onClick,
  type = 'button',
  disabled = false,
  isFullWidth = false,
  'data-testid': testId
}: SettingsPrimaryButtonProps): ReactElement {
  return (
    <ButtonBase
      type={type}
      onClick={onClick}
      disabled={disabled}
      sx={
        isFullWidth
          ? { ...PRIMARY_SX, width: '100%', maxWidth: 'none' }
          : PRIMARY_SX
      }
      data-testid={testId}
    >
      {icon === undefined ? null : (
        <Icon icon={icon} size={16} aria-hidden="true" />
      )}
      {label}
    </ButtonBase>
  )
}

const TEXT_SX = {
  height: 48,
  px: 2,
  borderRadius: '100px',
  color: 'primary.main',
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  letterSpacing: '0.1px',
  '&:hover': { bgcolor: TMAIL.blueHover },
  '&.Mui-disabled': { opacity: 0.38 }
} as const

export interface SettingsTextButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
  'data-testid'?: string
}

/** A secondary action of a settings form, e.g. "Cancel": blue text only */
export function SettingsTextButton({
  label,
  onClick,
  disabled = false,
  'data-testid': testId
}: SettingsTextButtonProps): ReactElement {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      sx={TEXT_SX}
      data-testid={testId}
    >
      {label}
    </ButtonBase>
  )
}

export interface SettingsRowButtonProps {
  /** What it shows, e.g. "Edit" */
  label: string
  /** Its accessible name and tooltip, e.g. "Edit Bob" */
  name?: string
  icon: IconProps['icon']
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  'data-testid'?: string
}

/** An action of a row of a settings list */
export function SettingsRowButton({
  label,
  name,
  icon,
  onClick,
  'data-testid': testId
}: SettingsRowButtonProps): ReactElement {
  const button = (
    <ButtonBase
      onClick={onClick}
      aria-label={name}
      sx={ROW_SX}
      data-testid={testId}
    >
      <Icon icon={icon} size={20} aria-hidden="true" />
      {label}
    </ButtonBase>
  )
  return name === undefined ? button : <Tooltip title={name}>{button}</Tooltip>
}
