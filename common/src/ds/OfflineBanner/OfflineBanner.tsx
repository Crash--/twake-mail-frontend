// Upstream to twake-ui: no. It composes `Alert` (filled, error) and a
// `Button`; the only local part is the pinning at the bottom of the
// screen, since `Snackbar` goes away by itself, where this state lasts
// until the network is back, and its announcement, which the page makes
// through a live region that is always there.
import { Alert, Box, Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export interface OfflineBannerProps {
  /** What is wrong, e.g. "No internet connection" */
  message: string
  /** Label of the button hiding the banner, e.g. "Skip" */
  dismissLabel: string
  onDismiss: () => void
  /** Room to leave at the bottom of the screen, e.g. for a floating button */
  bottomOffset?: number
  'data-testid'?: string
}

/**
 * A red banner at the bottom of the screen saying the network is gone, with
 * a button to hide it. Not a live region: one that appears together with its
 * text is often not read, so the page says it through a region that is
 * always mounted, once, politely; the text carries the information, not the
 * colour.
 */
export function OfflineBanner({
  message,
  dismissLabel,
  onDismiss,
  bottomOffset = 0,
  'data-testid': testId
}: OfflineBannerProps): ReactElement {
  return (
    <Box
      className="u-flex u-flex-justify-center"
      sx={theme => ({
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: `calc(${theme.spacing(3)} + ${bottomOffset}px + env(safe-area-inset-bottom))`,
        zIndex: theme.zIndex.snackbar,
        pointerEvents: 'none',
        '& > *': { pointerEvents: 'auto' }
      })}
    >
      <Alert
        variant="filled"
        severity="error"
        role="none"
        data-testid={testId}
        action={
          <Button color="inherit" size="small" onClick={onDismiss}>
            {dismissLabel}
          </Button>
        }
      >
        {message}
      </Alert>
    </Box>
  )
}
