// Upstream to twake-ui: no. The "Back" of the settings: a square twake-mui
// `Chip` with a chevron before its text.
import { Icon } from '@linagora/twake-icons'
import { Chip } from '@linagora/twake-mui'
import type { ElementType, ReactElement } from 'react'

import { Left } from '@/ds/FlutterIcons/FlutterIcons'

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
    <Chip
      {...linkProps}
      className="square"
      clickable
      label={children}
      icon={<Icon icon={Left} size={9} aria-hidden="true" />}
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
    />
  )
}
