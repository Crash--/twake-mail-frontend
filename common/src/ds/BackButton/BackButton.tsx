// Upstream to twake-ui: no, the look of tmail-flutter's back button of the
// reading view (`EmailViewBackButtonStyles`): a 20 px chevron and the name
// of the folder in Regular 15/20, both steel grey (#55687D).
import { Icon, Left } from '@linagora/twake-icons'
import { Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

const BUTTON_SX = {
  minWidth: 0,
  px: 1,
  gap: '4px',
  color: '#55687D',
  fontSize: 15,
  fontWeight: 400,
  lineHeight: '20px',
  letterSpacing: 0,
  textTransform: 'none',
  '& .MuiButton-startIcon': { m: 0 }
} as const

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
      startIcon={<Icon icon={Left} size={20} aria-hidden="true" />}
      onClick={onClick}
      aria-label={label}
      sx={BUTTON_SX}
      data-testid={testId}
    >
      {children}
    </Button>
  )
}
