// Upstream to twake-ui: yes. twake-mui re-exports MUI's `Snackbar`, which
// mounts its `role="alert"` content on demand (screen readers often miss a
// live region that appears with its text), closes on a timer without
// pausing on focus, and has no notion of a polite message. A notification
// region with both live regions always mounted, pause on hover and focus,
// and an action button would serve every Twake app.
import { Cross, Icon } from '@linagora/twake-icons'
import {
  Box,
  Button,
  Fade,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useMediaQuery,
  type Theme
} from '@linagora/twake-mui'
import type { SystemStyleObject } from '@mui/system'
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement
} from 'react'

/** `error` is announced at once (`role="alert"`), the others politely */
export type ToastSeverity = 'info' | 'success' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
  'data-testid'?: string
}

export interface ToastItem {
  /** Changes for every toast, even with the same message */
  id: string
  message: string
  severity: ToastSeverity
  action?: ToastAction | null
  /**
   * Time the toast stays, in ms, not counting the time it is hovered or
   * holds the focus; `null` keeps it until it is closed
   */
  duration?: number | null
}

/** Time a toast stays: long enough to read it, and to reach its action */
export const TOAST_DURATION = 6_000
export const TOAST_WITH_ACTION_DURATION = 10_000

export type ToastCloseReason = 'timeout' | 'action' | 'close'

export interface ToastRegionProps {
  /** The toast shown, null for none: a new one replaces the previous one */
  toast: ToastItem | null
  onClose: (id: string, reason: ToastCloseReason) => void
  /** Name and tooltip of the close button */
  closeLabel: string
  /** Room to leave at the bottom of the screen, e.g. for a floating button */
  bottomOffset?: number
  'data-testid'?: string
}

function defaultDuration(toast: ToastItem): number | null {
  if (toast.duration !== undefined) return toast.duration
  return toast.action ? TOAST_WITH_ACTION_DURATION : TOAST_DURATION
}

/**
 * Calls `onTimeout` once the toast has been shown for `duration` ms, not
 * counting the time it was paused (hovered, focused) or the page hidden.
 */
function useCountdown(
  duration: number | null,
  isPaused: boolean,
  onTimeout: () => void
): void {
  const remaining = useRef(duration)
  const [isPageHidden, setIsPageHidden] = useState(false)
  // The countdown goes on when the parent renders with a new handler
  const timeoutHandler = useRef(onTimeout)
  useEffect(() => {
    timeoutHandler.current = onTimeout
  }, [onTimeout])

  useEffect(() => {
    const handleVisibility = (): void => {
      setIsPageHidden(document.visibilityState === 'hidden')
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    const left = remaining.current
    if (left === null || isPaused || isPageHidden) return
    const startedAt = Date.now()
    const timer = setTimeout(() => {
      timeoutHandler.current()
    }, left)
    return () => {
      clearTimeout(timer)
      remaining.current = Math.max(0, left - (Date.now() - startedAt))
    }
  }, [isPaused, isPageHidden])
}

function regionStyle(
  theme: Theme,
  bottomOffset: number
): SystemStyleObject<Theme> {
  return {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: theme.zIndex.snackbar,
    width: 'max-content',
    maxWidth: `min(424px, calc(100vw - ${theme.spacing(4)}))`,
    bottom: `calc(${theme.spacing(3)} + ${bottomOffset}px + env(safe-area-inset-bottom))`
  }
}

const SEVERITY_STYLES: Record<
  ToastSeverity,
  (theme: Theme) => SystemStyleObject<Theme>
> = {
  // The dark surface of a snackbar: white on Grey 900, 15:1
  info: theme => ({
    backgroundColor: theme.palette.grey[900],
    color: theme.palette.common.white
  }),
  success: theme => ({
    backgroundColor: theme.palette.grey[900],
    color: theme.palette.common.white
  }),
  // White on error.dark (#c62828 in MUI), 5.6:1
  error: theme => ({
    backgroundColor: theme.palette.error.dark,
    color: theme.palette.common.white
  })
}

/** Light controls on the dark surface, with a visible focus */
function controlStyle(theme: Theme): SystemStyleObject<Theme> {
  return {
    color: 'inherit',
    flexShrink: 0,
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.common.white}`,
      outlineOffset: '2px'
    }
  }
}

/**
 * Where the app tells about what just happened (a message moved, an error),
 * away from the focus: one toast at a time at the bottom of the screen, a
 * new one replacing the previous one.
 *
 * - Its message is announced by a live region always present in the page
 *   (`role="status"`, polite, or `role="alert"`, assertive, for errors): a
 *   live region added together with its text is often not read.
 * - It stays `TOAST_DURATION` (`TOAST_WITH_ACTION_DURATION` with an action),
 *   a countdown paused while it is hovered, holds the focus, or the page is
 *   hidden: anyone has the time to reach its action (WCAG 2.2.1).
 * - Escape closes it while it has the focus. No animation when the user
 *   asks for reduced motion.
 */
interface ToastCardProps {
  toast: ToastItem
  onClose: (id: string, reason: ToastCloseReason) => void
  closeLabel: string
  'data-testid'?: string
}

/** The visible toast, mounted again for each new one */
const ToastCard = forwardRef<HTMLDivElement, ToastCardProps>(function ToastCard(
  { toast, onClose, closeLabel, 'data-testid': testId, ...transitionProps },
  ref
) {
  const messageId = useId()
  const [isHovered, setIsHovered] = useState(false)
  const [hasFocus, setHasFocus] = useState(false)
  useCountdown(defaultDuration(toast), isHovered || hasFocus, () => {
    onClose(toast.id, 'timeout')
  })

  const handleMouseEnter = (): void => {
    setIsHovered(true)
  }
  const handleMouseLeave = (): void => {
    setIsHovered(false)
  }
  const handleFocus = (): void => {
    setHasFocus(true)
  }
  const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose(toast.id, 'close')
    }
  }
  const handleAction = (): void => {
    onClose(toast.id, 'action')
    toast.action?.onClick()
  }
  const handleClose = (): void => {
    onClose(toast.id, 'close')
  }

  return (
    <Paper
      {...transitionProps}
      ref={ref}
      elevation={6}
      className="u-flex u-flex-items-center u-pl-1 u-pr-half u-pv-half"
      sx={theme => ({ ...SEVERITY_STYLES[toast.severity](theme), gap: 1 })}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      data-testid={testId}
      data-severity={toast.severity}
    >
      {/* Read by the live regions of the region, not twice */}
      <Typography
        id={messageId}
        variant="body2"
        aria-hidden="true"
        className="u-flex-auto u-pv-half"
        sx={{ color: 'inherit' }}
      >
        {toast.message}
      </Typography>
      {toast.action ? (
        <Button
          size="small"
          variant="text"
          onClick={handleAction}
          aria-describedby={messageId}
          data-testid={toast.action['data-testid']}
          sx={theme => ({ ...controlStyle(theme), fontWeight: 'bold' })}
        >
          {toast.action.label}
        </Button>
      ) : null}
      <Tooltip title={closeLabel}>
        <IconButton
          size="small"
          aria-label={closeLabel}
          aria-describedby={messageId}
          onClick={handleClose}
          data-testid={testId ? `${testId}-close-button` : undefined}
          sx={controlStyle}
        >
          <Icon icon={Cross} size={12} />
        </IconButton>
      </Tooltip>
    </Paper>
  )
})

export function ToastRegion({
  toast,
  onClose,
  closeLabel,
  bottomOffset = 0,
  'data-testid': testId
}: ToastRegionProps): ReactElement {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const isAlert = toast?.severity === 'error'
  const politeMessage = toast !== null && !isAlert ? toast.message : null
  const alertMessage = toast !== null && isAlert ? toast.message : null

  return (
    <>
      {/* Always mounted: a live region only announces what changes in it */}
      <Box role="status" className="u-visuallyhidden">
        {politeMessage === null ? null : (
          <span key={toast?.id}>{politeMessage}</span>
        )}
      </Box>
      <Box role="alert" className="u-visuallyhidden">
        {alertMessage === null ? null : (
          <span key={toast?.id}>{alertMessage}</span>
        )}
      </Box>
      {toast === null ? null : (
        <Box sx={theme => regionStyle(theme, bottomOffset)}>
          <Fade key={toast.id} in appear timeout={reducedMotion ? 0 : 200}>
            <ToastCard
              toast={toast}
              onClose={onClose}
              closeLabel={closeLabel}
              data-testid={testId}
            />
          </Fade>
        </Box>
      )}
    </>
  )
}
