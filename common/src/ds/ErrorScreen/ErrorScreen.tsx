// Upstream to twake-ui: yes, as a variant of `Empty`. Every Twake app
// shows full-page errors (session, crash, unreachable server) with a
// recovery action; twake-mui only has the empty state it is built on.
import { Warning } from '@linagora/twake-icons'
import { Box, Button, Empty } from '@linagora/twake-mui'
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'
import {
  MainLandmark,
  useIsInMainLandmark
} from '@/ds/MainLandmark/MainLandmark'

export interface ErrorScreenProps {
  title: string
  description?: ReactNode
  actionLabel?: string
  onAction?: () => void
  /**
   * The level of the title: `h1` when the error is the whole view, which is
   * then the `main` landmark of the page unless a layout already has one
   */
  headingLevel?: 'h1' | 'h2' | 'h3'
  /**
   * Moves the focus to the action, or to the title without one, when the
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
  headingLevel = 'h3',
  focusOnMount = false,
  'data-testid': testId = 'error-screen'
}: ErrorScreenProps): ReactElement {
  const titleRef = useRef<HTMLElement>(null)
  const actionRef = useRef<HTMLButtonElement>(null)
  const hasAction = Boolean(actionLabel && onAction)
  const isInMain = useIsInMainLandmark()

  useEffect(() => {
    if (!focusOnMount) return
    const target = actionRef.current ?? titleRef.current
    target?.focus()
  }, [focusOnMount])

  const screen = (
    <Box className="u-flex u-h-100" role="alert" data-testid={testId}>
      <Empty
        icon={Warning}
        iconSize="normal"
        title={title}
        text={description}
        componentsProps={{
          // The title says it: the icon is decoration
          icon: { 'aria-hidden': true },
          title: {
            ref: titleRef,
            component: headingLevel,
            tabIndex: focusOnMount && !hasAction ? -1 : undefined
          }
        }}
      >
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

  if (headingLevel === 'h1' && !isInMain) {
    return <MainLandmark className="u-h-100">{screen}</MainLandmark>
  }
  return screen
}
