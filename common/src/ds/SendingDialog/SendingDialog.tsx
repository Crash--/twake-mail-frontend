// Upstream to twake-ui: no, a plain `StandardDialog` that cannot be
// dismissed: it goes once the message is sent or failed, unless the server is
// slow to answer: then it says so and offers to close it (`tf#2603`).
import {
  Button,
  LinearProgress,
  StandardDialog,
  Typography
} from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

export interface SendingDialogProps {
  open: boolean
  /** "Sending message" */
  title: string
  /** "Status" */
  statusLabel: string
  /** The step under way, e.g. "Creating message" */
  status: string
  /** "Progress" */
  progressLabel: string
  /**
   * Said once the server is slow to answer, e.g. "It is taking longer than
   * usual…": the dialog then has a button that closes it. Null otherwise
   */
  slowMessage?: string | null
  /** "Close", the button shown with `slowMessage` */
  closeLabel?: string
  /** The user closed the dialog (its button or Escape, once slow) */
  onClose?: () => void
  'data-testid'?: string
}

/**
 * A modal dialog saying that a message is being sent: its title, the step
 * under way and an indeterminate progress bar. It takes the focus (its
 * content is announced) and gives it back when it closes; neither Escape
 * nor a click outside closes it. Given a `slowMessage`, it says it and
 * shows a Close button and the dialog's close cross, which close it as
 * Escape does.
 */
export function SendingDialog({
  open,
  title,
  statusLabel,
  status,
  progressLabel,
  slowMessage = null,
  closeLabel,
  onClose,
  'data-testid': testId
}: SendingDialogProps): ReactElement {
  const statusId = useId()
  const progressId = useId()
  const slowId = useId()
  const isClosable = slowMessage !== null && onClose !== undefined
  return (
    <StandardDialog
      open={open}
      size="small"
      // Given only once slow: `StandardDialog` adds its close cross with it
      onClose={
        isClosable
          ? (_event, reason): void => {
              if (reason !== 'backdropClick') onClose()
            }
          : undefined
      }
      aria-describedby={
        slowMessage === null ? statusId : `${statusId} ${slowId}`
      }
      aria-busy
      data-testid={testId}
      title={title}
      content={
        <>
          <Typography variant="body2" component="p">
            {`${statusLabel}: `}
            <Typography
              id={statusId}
              component="span"
              variant="body2"
              role="status"
              color="text.secondary"
            >
              {`${status}...`}
            </Typography>
          </Typography>
          <Typography
            id={progressId}
            variant="body2"
            component="p"
            sx={{ mt: 2, mb: 1 }}
          >
            {`${progressLabel}:`}
          </Typography>
          <LinearProgress aria-labelledby={progressId} />
          {slowMessage === null ? null : (
            <Typography
              id={slowId}
              role="alert"
              variant="body2"
              color="text.secondary"
              sx={{ mt: 2 }}
            >
              {slowMessage}
            </Typography>
          )}
        </>
      }
      actions={
        isClosable ? (
          <Button
            variant="text"
            autoFocus
            onClick={onClose}
            data-testid={
              testId === undefined ? undefined : `${testId}-close-button`
            }
          >
            {closeLabel}
          </Button>
        ) : null
      }
    />
  )
}
