// Upstream to twake-ui: no. The buttons of the settings: the main action of
// a section ("Create new identity", "Add rule"), a secondary one ("Cancel"),
// and the action of a row ("Edit", "Delete"), twake-mui's `Button` with an
// icon before the label.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Button, Tooltip } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement } from 'react'

const PRIMARY_SX = {
  flexShrink: 0,
  maxWidth: 300,
  whiteSpace: 'nowrap'
} as const

export interface SettingsPrimaryButtonProps {
  label: string
  /** Before the label, if any */
  icon?: IconProps['icon']
  /** Of the icon, 16 px by default */
  iconSize?: number
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
  iconSize = 16,
  onClick,
  type = 'button',
  disabled = false,
  isFullWidth = false,
  'data-testid': testId
}: SettingsPrimaryButtonProps): ReactElement {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      fullWidth={isFullWidth}
      startIcon={
        icon === undefined ? undefined : (
          <Icon icon={icon} size={iconSize} aria-hidden="true" />
        )
      }
      sx={isFullWidth ? undefined : PRIMARY_SX}
      data-testid={testId}
    >
      {label}
    </Button>
  )
}

export interface SettingsTextButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
  'data-testid'?: string
}

/** A secondary action of a settings form, e.g. "Cancel": text only */
export function SettingsTextButton({
  label,
  onClick,
  disabled = false,
  'data-testid': testId
}: SettingsTextButtonProps): ReactElement {
  return (
    <Button
      variant="text"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      {label}
    </Button>
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
    <Button
      variant="text"
      onClick={onClick}
      aria-label={name}
      startIcon={<Icon icon={icon} size={20} aria-hidden="true" />}
      sx={{ whiteSpace: 'nowrap' }}
      data-testid={testId}
    >
      {label}
    </Button>
  )
  return name === undefined ? button : <Tooltip title={name}>{button}</Tooltip>
}
