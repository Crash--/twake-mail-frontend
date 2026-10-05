// Upstream to twake-ui: no. It composes `Alert` (filled, error) and a
// `Button`; the only local part is the pinning at the bottom of the
// positioned parent, since `Snackbar` is fixed to the viewport and goes away
// by itself, where this state lasts until the network is back.
import { Alert, Box, Button } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export interface OfflineBannerProps {
  /** What is wrong, e.g. "No internet connection" */
  message: string
  /** Label of the button hiding the banner, e.g. "Dismiss" */
  dismissLabel: string
  onDismiss: () => void
  'data-testid'?: string
}

/**
 * A red banner at the bottom of the screen saying the network is gone, with
 * a button to hide it. An `Alert` (`role="alert"`): the state is announced
 * when it appears, and the text carries the information, not the colour.
 */
export function OfflineBanner({
  message,
  dismissLabel,
  onDismiss,
  'data-testid': testId
}: OfflineBannerProps): ReactElement {
  return (
    <Box
      className="u-flex u-flex-justify-center"
      sx={theme => ({
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: theme.spacing(3),
        zIndex: theme.zIndex.snackbar,
        pointerEvents: 'none',
        '& > *': { pointerEvents: 'auto' }
      })}
    >
      <Alert
        variant="filled"
        severity="error"
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
