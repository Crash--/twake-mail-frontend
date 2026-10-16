// Upstream to twake-ui: yes, as a variant of `Empty`. Every Twake app
// shows full-page errors (session, crash, unreachable server) with a
// recovery action; twake-mui only has the empty state it is built on.
import { Box, Button, Empty } from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'
import { Warning } from '@/ds/FlutterIcons/FlutterIcons'

export interface ErrorScreenProps {
  title: string
  description?: ReactNode
  actionLabel?: string
  onAction?: () => void
  /** The level of the title: `h1` when the error is the whole view */
  headingLevel?: 'h1' | 'h2' | 'h3'
  /** Moves the focus to the title when the screen shows (a view opening) */
  autoFocus?: boolean
  'data-testid'?: string
}

/**
 * Full-page error, announced as an alert, with an optional action to
 * recover from it.
 */
export function ErrorScreen({
  title,
  description,
  actionLabel,
  onAction,
  headingLevel = 'h3',
  autoFocus = false,
  'data-testid': testId = 'error-screen'
}: ErrorScreenProps): ReactElement {
  const titleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus()
  }, [autoFocus])

  return (
    <Box className="u-flex u-h-100" role="alert" data-testid={testId}>
      <Empty
        icon={Warning}
        iconSize="normal"
        title={title}
        text={description}
        componentsProps={{
          title: {
            ref: titleRef,
            component: headingLevel,
            tabIndex: autoFocus ? -1 : undefined
          }
        }}
      >
        {actionLabel && onAction ? (
          <Button
            variant="contained"
            onClick={onAction}
            data-testid={`${testId}-action`}
          >
            {actionLabel}
          </Button>
        ) : null}
      </Empty>
    </Box>
  )
}
