// Upstream to twake-ui: no, the look of tmail-flutter's "Back" of the
// settings (`back_to_dashboard_button`): a light grey (#EAEDF2) chip with a
// radius of 8, a 9 px chevron and the label in Medium 12 blue.
import { Icon } from '@linagora/twake-icons'
import { ButtonBase } from '@linagora/twake-mui'
import type { ElementType, ReactElement } from 'react'
import { Left } from '@/ds/FlutterIcons/FlutterIcons'

const CHIP_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  minWidth: 79,
  minHeight: 32,
  boxSizing: 'border-box',
  pl: '19px',
  pr: '12px',
  py: '8px',
  borderRadius: '8px',
  bgcolor: '#EAEDF2',
  color: '#0F76E7',
  fontSize: 12,
  fontWeight: 500,
  lineHeight: '16px',
  letterSpacing: '0.4px',
  '& svg': { color: '#007AFF' },
  '&:hover': { bgcolor: '#DFE3EA' }
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

/** A small chip going back, the chevron before its text */
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
      sx={CHIP_SX}
      data-testid={testId}
    >
      <Icon icon={Left} size={9} aria-hidden="true" />
      {children}
    </ButtonBase>
  )
}
