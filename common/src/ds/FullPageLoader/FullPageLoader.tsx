// Upstream to twake-ui: yes. A full-page spinner is needed by every Twake
// app while the SSO, the session or the first data load; twake-mui only has
// the bare `CircularProgress`.
import { Box, CircularProgress } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export interface FullPageLoaderProps {
  /** Accessible name of the spinner, e.g. "Loading…" */
  label: string
  'data-testid'?: string
}

/**
 * A spinner centered in the whole available space, announced as a busy
 * progress bar named by `label`.
 */
export function FullPageLoader({
  label,
  'data-testid': testId
}: FullPageLoaderProps): ReactElement {
  return (
    <Box
      className="u-flex u-flex-items-center u-flex-justify-center u-h-100"
      aria-busy="true"
      data-testid={testId}
    >
      <CircularProgress aria-label={label} />
    </Box>
  )
}
