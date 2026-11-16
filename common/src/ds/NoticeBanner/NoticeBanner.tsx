// Upstream to twake-ui: yes, as an option of `Alert`. A notice above a list
// or a message (Trash emptied when storage runs out, remote images hidden):
// twake-mui's `secondary` `Alert` with a primary text action; on a phone the
// actions go on a row of their own under the message when they do not fit
// beside it, as the Teammail 1.1 design; a close button after the actions
// (MUI's own goes away with `action`).
import { Icon, Cross } from '@linagora/twake-icons'
import { Alert, Button, IconButton } from '@linagora/twake-mui'
import type { ReactElement, ReactNode, Ref } from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

// TODO: drop once twake-mui's `Alert` can put its action under the message
// (https://github.com/Crash--/twake-ui/issues/26)
// The message asks for the width of its text, at most the row beside the
// icon (16 px and its 12 px margin): the actions stay beside it while they
// fit, the growing message pushing them to the end, and wrap to the start of
// a row of their own otherwise
const STACKED_SX = {
  flexWrap: 'wrap',
  '& .MuiAlert-message': {
    flex: '1 1 auto',
    minWidth: 0,
    maxWidth: 'calc(100% - 28px)'
  },
  '& .MuiAlert-action': {
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

export interface NoticeBannerDismiss {
  /** The name of the close button, e.g. "Close" */
  label: string
  onClick: () => void
  'data-testid'?: string
}

export interface NoticeBannerProps {
  children: ReactNode
  actions: readonly NoticeBannerAction[]
  /** A close button after the actions */
  dismiss?: NoticeBannerDismiss
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
  dismiss,
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
      action={
        <>
          {actions.map(action => (
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
          {dismiss === undefined ? null : (
            <IconButton
              color="inherit"
              size="small"
              aria-label={dismiss.label}
              onClick={dismiss.onClick}
              data-testid={dismiss['data-testid']}
            >
              <Icon icon={Cross} size={16} aria-hidden="true" />
            </IconButton>
          )}
        </>
      }
      data-testid={testId}
    >
      {children}
    </Alert>
  )
}
