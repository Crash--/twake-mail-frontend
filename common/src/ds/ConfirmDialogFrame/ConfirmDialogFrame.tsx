// Upstream to twake-ui: no, the look of tmail-flutter's confirmation
// dialog (`ConfirmationDialogBuilder`): 421 px wide, a 16 px radius, a
// close cross at the top end, the title centred in Semi Bold 24, the
// message in Regular 16 / 24 (#424244), and at the end the actions: text
// buttons and the confirming one, a 48 px blue (#0A84FF) pill.
import { Icon } from '@linagora/twake-icons'
import { Box, Button, Dialog, IconButton, Typography } from '@mui/material'
import type { ReactElement, ReactNode } from 'react'

import { CloseDialog } from '@/ds/FlutterIcons/FlutterIcons'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

const TEXT_COLOR = TMAIL.textGrey
const PRIMARY = TMAIL.primary0A
/** The confirming pill keeps that blue, its label white, in both schemes */
const PRIMARY_FILL = '#0A84FF'

const PAPER_SX = {
  width: 421,
  maxWidth: 'calc(100% - 32px)',
  m: 2,
  borderRadius: '16px',
  position: 'relative',
  boxSizing: 'border-box',
  pt: 3,
  px: 4,
  pb: 4
} as const

const TITLE_SX = {
  m: 0,
  textAlign: 'center',
  fontSize: 24,
  fontWeight: 600,
  lineHeight: '32px',
  color: TEXT_COLOR
} as const

const MESSAGE_SX = {
  mt: 4,
  fontSize: 16,
  fontWeight: 400,
  lineHeight: '24px',
  letterSpacing: '-0.15px',
  color: TEXT_COLOR
} as const

const LABEL_SX = {
  height: 48,
  borderRadius: '100px',
  px: '10px',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  letterSpacing: '0.1px',
  textTransform: 'none',
  boxShadow: 'none'
} as const

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

/** A dialog asking to confirm, as tmail-flutter's */
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
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      slotProps={{
        paper: { sx: PAPER_SX },
        transition: { onExited }
      }}
      data-testid={testId}
    >
      {hasCloseButton ? (
        <IconButton
          aria-label={closeLabel}
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            color: TMAIL.steelLight
          }}
        >
          <Icon icon={CloseDialog} size={24} />
        </IconButton>
      ) : null}
      <Typography id={titleId} component="h2" sx={TITLE_SX}>
        {title}
      </Typography>
      {/* A paragraph for a text, a block for richer content */}
      <Typography
        id={messageId}
        component={typeof message === 'string' ? 'p' : 'div'}
        sx={MESSAGE_SX}
      >
        {message}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
          mt: '44px',
          px: '12px'
        }}
      >
        {children}
      </Box>
    </Dialog>
  )
}

export interface ConfirmDialogButtonProps {
  children: ReactNode
  /** Not needed for the submit button of a form */
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  /** Its least width, in px: 135 for the main one, 67 for the others */
  minWidth?: number
  /** The confirming action: a blue pill, else blue text */
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
  minWidth,
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
      sx={{
        ...LABEL_SX,
        minWidth: minWidth ?? (isMain ? 135 : 67),
        flex: isFullWidth ? '1 1 auto' : undefined,
        color: isMain ? '#FFFFFF' : PRIMARY,
        bgcolor: isMain ? PRIMARY_FILL : 'transparent'
      }}
      data-testid={testId}
    >
      {children}
    </Button>
  )
}
