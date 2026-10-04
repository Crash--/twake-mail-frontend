import { Warning } from '@linagora/twake-icons'
import { Box, Button, Empty } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface ErrorScreenProps {
  title: string
  description?: ReactNode
  actionLabel?: string
  onAction?: () => void
  'data-testid'?: string
}

/**
 * Full-page error, with an optional action to recover from it.
 */
export function ErrorScreen({
  title,
  description,
  actionLabel,
  onAction,
  'data-testid': testId = 'error-screen'
}: ErrorScreenProps): ReactElement {
  return (
    <Box className="u-flex u-h-100" role="alert" data-testid={testId}>
      <Empty icon={Warning} iconSize="normal" title={title} text={description}>
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
