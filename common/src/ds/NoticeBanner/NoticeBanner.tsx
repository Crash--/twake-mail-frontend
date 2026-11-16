// Upstream to twake-ui: yes, as an option of `Alert`. A notice above a list
// or a message (Trash emptied when storage runs out, remote images hidden):
// twake-mui's `secondary` `Alert` with a primary text action, the action on
// a row of its own under the message on a phone, as the Teammail 1.1 design.
import { Alert, Button } from '@linagora/twake-mui'
import type { ReactElement, ReactNode, Ref } from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

// TODO: drop once twake-mui's `Alert` can put its action under the message
// (https://github.com/Crash--/twake-ui/issues/26)
const STACKED_SX = {
  flexWrap: 'wrap',
  '& .MuiAlert-message': { flex: '1 1 0', minWidth: 0 },
  '& .MuiAlert-action': {
    flexBasis: '100%',
    flexWrap: 'wrap',
    m: 0,
    p: 0,
    justifyContent: 'flex-start'
  }
} as const

export interface NoticeBannerAction {
  label: string
  onClick: () => void
  disabled?: boolean
  'data-testid'?: string
}

export interface NoticeBannerProps {
  children: ReactNode
  actions: readonly NoticeBannerAction[]
  /** `note`: part of the screen, not an event, so no live announcement */
  role?: 'note' | 'status'
  className?: string
  ref?: Ref<HTMLDivElement>
  'data-testid'?: string
}

/** A grey notice, its actions beside it, under it on a phone */
export function NoticeBanner({
  children,
  actions,
  role = 'note',
  className,
  ref,
  'data-testid': testId
}: NoticeBannerProps): ReactElement {
  const isPhone = useScreenSize() === 'mobile'
  return (
    <Alert
      ref={ref}
      severity="secondary"
      role={role}
      className={className}
      sx={isPhone ? STACKED_SX : undefined}
      action={actions.map(action => (
        <Button
          key={action.label}
          variant="text"
          size="small"
          disabled={action.disabled}
          onClick={action.onClick}
          data-testid={action['data-testid']}
        >
          {action.label}
        </Button>
      ))}
      data-testid={testId}
    >
      {children}
    </Alert>
  )
}
