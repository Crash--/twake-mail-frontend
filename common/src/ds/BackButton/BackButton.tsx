import { Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { Back } from '@/ds/FlutterIcons/FlutterIcons'

export interface BackButtonProps {
  /** What it shows, e.g. the folder it returns to */
  children: string
  /** Its accessible name when the text says less, e.g. "Back to Inbox" */
  label?: string
  onClick: () => void
  'data-testid'?: string
}

/** A text button going back, the chevron before its text */
export function BackButton({
  children,
  label,
  onClick,
  'data-testid': testId
}: BackButtonProps): ReactElement {
  return (
    <Button
      variant="text"
      startIcon={<Back width={9} height={16} aria-hidden="true" />}
      onClick={onClick}
      aria-label={label}
      color="inherit"
      data-testid={testId}
    >
      {children}
    </Button>
  )
}
