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
  /**
   * Moves the focus to the action, or to the error without one, when the
   * screen shows in place of a view
   */
  focusOnMount?: boolean
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
  focusOnMount = false,
  'data-testid': testId = 'error-screen'
}: ErrorScreenProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const actionRef = useRef<HTMLButtonElement>(null)
  const hasAction = Boolean(actionLabel && onAction)

  useEffect(() => {
    if (!focusOnMount) return
    const target = actionRef.current ?? containerRef.current
    target?.focus()
  }, [focusOnMount])

  return (
    <Box
      ref={containerRef}
      className="u-flex u-h-100"
      role="alert"
      tabIndex={focusOnMount && !hasAction ? -1 : undefined}
      data-testid={testId}
    >
      <Empty icon={Warning} iconSize="normal" title={title} text={description}>
        {hasAction ? (
          <Button
            ref={actionRef}
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
