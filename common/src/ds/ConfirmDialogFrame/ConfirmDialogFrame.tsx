// Upstream to twake-ui: no. A confirmation dialog on twake-mui's small
// `Dialog` (title, content, actions), with a close cross at the top end.
// twake-mui's `ConfirmDialog` is not used: its close button is named and
// tagged by twake-mui, not by the app.
import { Icon, Cross } from '@linagora/twake-icons'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography
} from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export interface ConfirmDialogFrameProps {
  open: boolean
  title: ReactNode
  message: ReactNode
  /** Names the close cross */
  closeLabel: string
  onClose: () => void
  /** Called once the dialog is gone (its transition ended) */
  onExited?: () => void
  titleId: string
  messageId: string
  /** The actions, `ConfirmDialogButton`s, the confirming one last */
  children: ReactNode
  /** Without the cross: a message closed by its one button (an error) */
  hasCloseButton?: boolean
  'data-testid'?: string
}

/** A dialog asking to confirm */
export function ConfirmDialogFrame({
  open,
  title,
  message,
  closeLabel,
  onClose,
  onExited,
  titleId,
  messageId,
  children,
  hasCloseButton = true,
  'data-testid': testId
}: ConfirmDialogFrameProps): ReactElement {
  return (
    <Dialog
      size="small"
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      slotProps={{ transition: { onExited } }}
      data-testid={testId}
    >
      {hasCloseButton ? (
        <IconButton
          aria-label={closeLabel}
          onClick={onClose}
          className="dialogIconButton dialogCloseButton"
        >
          <Icon icon={Cross} size={24} aria-hidden="true" />
        </IconButton>
      ) : null}
      <DialogTitle
        id={titleId}
        className={hasCloseButton ? 'dialogTitleWithClose' : undefined}
      >
        {title}
      </DialogTitle>
      <DialogContent>
        {/* A paragraph for a text, a block for richer content */}
        <Typography
          id={messageId}
          component={typeof message === 'string' ? 'p' : 'div'}
          sx={{ m: 0 }}
        >
          {message}
        </Typography>
      </DialogContent>
      <DialogActions>{children}</DialogActions>
    </Dialog>
  )
}

export interface ConfirmDialogButtonProps {
  children: ReactNode
  /** Not needed for the submit button of a form */
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  /** The confirming action: a filled button, else text */
  isMain?: boolean
  /** As wide as the dialog: the one button of a message */
  isFullWidth?: boolean
  autoFocus?: boolean
  'data-testid'?: string
}

/** An action of `ConfirmDialogFrame` */
export function ConfirmDialogButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  isMain = false,
  isFullWidth = false,
  autoFocus,
  'data-testid': testId
}: ConfirmDialogButtonProps): ReactElement {
  return (
    <Button
      variant={isMain ? 'contained' : 'text'}
      type={type}
      disabled={disabled}
      onClick={onClick}
      autoFocus={autoFocus}
      fullWidth={isFullWidth}
      data-testid={testId}
    >
      {children}
    </Button>
  )
}
