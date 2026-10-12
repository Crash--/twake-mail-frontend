// Upstream to twake-ui: yes. The "mail action bar" of the Teammail 1.1 mocks:
// a divider, then buttons sharing the width, kept at the bottom of the
// scrolling area it is in.
import { Box, Button, Divider } from '@linagora/twake-mui'
import type { MouseEventHandler, ReactElement, ReactNode } from 'react'

import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

const BAR_SX = {
  position: 'sticky',
  bottom: 0,
  zIndex: 1,
  bgcolor: 'background.paper',
  mt: 'auto'
} as const

const ROW_SX = {
  display: 'flex',
  gap: 1,
  px: 2,
  py: 0.5,
  minHeight: 56
} as const

const BUTTON_SX = {
  flex: 1,
  minHeight: 48,
  borderRadius: '100px',
  color: 'text.primary',
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  letterSpacing: '0.1px',
  gap: 1,
  '& .MuiButton-startIcon': { m: 0, '& > *:first-of-type': { fontSize: 20 } },
  // tmail-flutter's bottom bar of tablets: steel grey, Regular 16
  [`@media ${SCREEN_QUERIES.belowDesktop}`]: {
    borderRadius: 0,
    color: TMAIL.steel,
    fontSize: 16,
    fontWeight: 400,
    letterSpacing: 0
  },
  // and of phones: the icon over a Regular 12 label
  [`@media ${SCREEN_QUERIES.mobile}`]: {
    flexDirection: 'column',
    gap: '4px',
    fontSize: 12,
    lineHeight: '16px'
  }
} as const

export interface ActionBarProps {
  /** Accessible name of the group */
  label: string
  /** `ActionBarButton`s */
  children: ReactNode
  'data-testid'?: string
}

/** The row of answers at the bottom of an email or a conversation */
export function ActionBar({
  label,
  children,
  'data-testid': testId
}: ActionBarProps): ReactElement {
  return (
    <Box role="group" aria-label={label} sx={BAR_SX} data-testid={testId}>
      <Divider />
      <Box sx={ROW_SX}>{children}</Box>
    </Box>
  )
}

export interface ActionBarButtonProps {
  icon: ReactNode
  children: ReactNode
  onClick: MouseEventHandler<HTMLButtonElement>
  'data-testid'?: string
}

/** A button of the `ActionBar`: a 20 px icon and a Medium 14/20 label */
export function ActionBarButton({
  icon,
  children,
  onClick,
  'data-testid': testId
}: ActionBarButtonProps): ReactElement {
  return (
    <Button
      variant="text"
      color="inherit"
      startIcon={icon}
      onClick={onClick}
      sx={BUTTON_SX}
      data-testid={testId}
    >
      {children}
    </Button>
  )
}
