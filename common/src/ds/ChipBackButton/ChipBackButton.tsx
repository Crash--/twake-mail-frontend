// Upstream to twake-ui: no. The "Back" of the settings, as the Figma's: a
// 32 px button on `primary.light`, rounded 12 px (not the pill of
// twake-mui's `Button`), a 16 px chevron before its text.
import { Icon, Left } from '@linagora/twake-icons'
import { ButtonBase } from '@linagora/twake-mui'
import type { ElementType, ReactElement } from 'react'

const BUTTON_SX = {
  gap: 1,
  minHeight: 32,
  px: 2,
  py: 1,
  boxSizing: 'border-box',
  borderRadius: '12px',
  bgcolor: 'primary.light',
  color: 'text.primary',
  typography: 'button',
  lineHeight: '20px',
  '&:hover': { filter: 'brightness(0.96)' }
} as const

export interface ChipBackButtonProps {
  /** What it shows, e.g. "Back" */
  children: string
  /** Its accessible name when the text says less, e.g. "Back to mail" */
  label?: string
  /** A link component (e.g. the router `Link`) and where it goes */
  component?: ElementType
  to?: string
  state?: unknown
  onClick?: () => void
  'data-testid'?: string
}

/** A small button going back, the chevron before its text */
export function ChipBackButton({
  children,
  label,
  component,
  to,
  state,
  onClick,
  'data-testid': testId
}: ChipBackButtonProps): ReactElement {
  const linkProps = component === undefined ? {} : { component, to, state }
  return (
    <ButtonBase
      {...linkProps}
      onClick={onClick}
      aria-label={label}
      sx={BUTTON_SX}
      data-testid={testId}
    >
      <Icon icon={Left} size={16} aria-hidden="true" />
      {children}
    </ButtonBase>
  )
}
