// Upstream to twake-ui: yes. A modal dialog holding another application in
// an iframe (the Twake Drive picker; Calendar and Chat embed it too): a
// named dialog, a loading state until the framed page says it is ready, the
// focus moved into the frame then, full screen on phones. twake-mui's
// Dialog has no such variant.
import { Cross, Icon } from '@linagora/twake-icons'
import {
  Box,
  CircularProgress,
  Dialog,
  IconButton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
  type MutableRefObject
} from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

const FRAME_SX = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
  '& iframe': { display: 'block', width: '100%', height: '100%', border: 0 }
} as const

const OVERLAY_SX = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  p: 3,
  bgcolor: 'background.paper',
  textAlign: 'center'
} as const

export interface FramedDialogProps {
  open: boolean
  /** Visible title, the name of the dialog */
  title: string
  /** The page to frame, null while it is not known yet */
  src: string | null
  /** Title of the iframe, for screen readers */
  frameTitle: string
  /** The framed page said it is ready: the loading state goes, the focus enters */
  isReady: boolean
  loadingLabel: string
  closeLabel: string
  onClose: () => void
  /** Shown instead of the frame (an error and its actions) */
  message?: ReactNode
  frameRef?: MutableRefObject<HTMLIFrameElement | null>
  /** Permissions of the framed page (`allow`) */
  allow?: string
  /**
   * The owner moves the focus itself on close (e.g. into what the dialog
   * inserted) instead of back to what opened the dialog
   */
  disableRestoreFocus?: boolean
  'data-testid'?: string
  frameTestId?: string
}

/**
 * A modal dialog framing another application: its title and a close
 * button, a progress indicator (`aria-busy`) until `isReady`, then the
 * focus in the frame; Escape (outside the frame) and the close button close
 * it and give the focus back to what opened it. Full screen on phones,
 * 800 × 680 at most elsewhere.
 */
export function FramedDialog({
  open,
  title,
  src,
  frameTitle,
  isReady,
  loadingLabel,
  closeLabel,
  onClose,
  message,
  frameRef,
  allow,
  disableRestoreFocus = false,
  'data-testid': testId,
  frameTestId
}: FramedDialogProps): ReactElement {
  const titleId = useId()
  const isPhone = useScreenSize() === 'mobile'
  const localRef = useRef<HTMLIFrameElement | null>(null)
  const ref = frameRef ?? localRef

  useEffect(() => {
    if (open && isReady) ref.current?.focus()
  }, [open, isReady, ref])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isPhone}
      fullWidth
      maxWidth={false}
      aria-labelledby={titleId}
      disableRestoreFocus={disableRestoreFocus}
      slotProps={{
        paper: {
          sx: isPhone
            ? { display: 'flex', flexDirection: 'column' }
            : {
                width: 800,
                maxWidth: 'calc(100% - 32px)',
                height: 680,
                maxHeight: 'calc(100% - 32px)',
                display: 'flex',
                flexDirection: 'column'
              }
        }
      }}
      data-testid={testId}
    >
      <Box
        className="u-flex u-flex-items-center u-ph-1 u-pv-half"
        sx={{ borderBottom: 1, borderColor: 'divider', flex: '0 0 auto' }}
      >
        <Typography
          id={titleId}
          variant="h4"
          component="h2"
          className="u-flex-auto u-ellipsis"
        >
          {title}
        </Typography>
        <Tooltip title={closeLabel}>
          <IconButton aria-label={closeLabel} onClick={onClose}>
            <Icon icon={Cross} aria-hidden="true" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={FRAME_SX} aria-busy={!isReady && message === undefined}>
        {src !== null && message === undefined ? (
          <iframe
            ref={ref}
            src={src}
            title={frameTitle}
            allow={allow}
            referrerPolicy="strict-origin-when-cross-origin"
            data-testid={frameTestId}
          />
        ) : null}
        {message !== undefined ? (
          <Box sx={OVERLAY_SX} role="alert">
            {message}
          </Box>
        ) : isReady ? null : (
          <Box sx={OVERLAY_SX} role="status">
            <CircularProgress aria-hidden="true" />
            <Typography>{loadingLabel}</Typography>
          </Box>
        )}
      </Box>
    </Dialog>
  )
}
