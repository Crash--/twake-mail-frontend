// Upstream to twake-ui: no. A form in twake-mui's large `Dialog`: the title
// and a close cross at the top end, the fields with their label in a 112 px
// column before them, and at the bottom an option at the start and the
// buttons at the end; on a phone the whole screen, an arrow back before the
// title, the labels over the fields.
import { Icon, Cross } from '@linagora/twake-icons'
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip
} from '@linagora/twake-mui'
import type { ReactElement, ReactNode, SubmitEvent } from 'react'

import { ArrowBack } from '@/ds/FlutterIcons/FlutterIcons'

const ACTIONS_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 1,
  ml: 'auto'
} as const

export interface FormDialogFrameProps {
  title: ReactNode
  titleId: string
  /** Names the close cross (the arrow back of a phone) */
  closeLabel: string
  onClose: () => void
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void
  /** The whole screen of a phone */
  isFullScreen?: boolean
  /** At the start of the bottom, e.g. a checkbox */
  footerStart?: ReactNode
  /** The buttons, `ConfirmDialogButton`s, the submitting one last */
  actions: ReactNode
  /** The fields, `FormFieldRow`s, and what follows them */
  children: ReactNode
  'data-testid'?: string
}

/** A form in a dialog */
export function FormDialogFrame({
  title,
  titleId,
  closeLabel,
  onClose,
  onSubmit,
  isFullScreen = false,
  footerStart,
  actions,
  children,
  'data-testid': testId
}: FormDialogFrameProps): ReactElement {
  const footer = (
    <>
      {footerStart}
      <Box className="FormDialogFrame-actions" sx={ACTIONS_SX}>
        {actions}
      </Box>
    </>
  )

  return (
    <Dialog
      open
      onClose={onClose}
      size="large"
      fullScreen={isFullScreen}
      aria-labelledby={titleId}
      data-testid={testId}
    >
      <Box
        component="form"
        onSubmit={onSubmit}
        noValidate
        className="u-flex u-flex-column u-ov-hidden"
        sx={{ maxHeight: isFullScreen ? '100dvh' : 'calc(100dvh - 48px)' }}
      >
        {isFullScreen ? (
          <>
            <Tooltip title={closeLabel}>
              <IconButton
                aria-label={closeLabel}
                onClick={onClose}
                className="dialogIconButton dialogBackButton"
              >
                <Icon icon={ArrowBack} size={24} />
              </IconButton>
            </Tooltip>
            <DialogTitle id={titleId} noWrap className="dialogTitleWithBack">
              {title}
            </DialogTitle>
          </>
        ) : (
          <>
            <DialogTitle id={titleId} noWrap className="dialogTitleWithClose">
              {title}
            </DialogTitle>
            <IconButton
              aria-label={closeLabel}
              onClick={onClose}
              className="dialogIconButton dialogCloseButton"
            >
              <Icon icon={Cross} size={24} />
            </IconButton>
          </>
        )}
        {isFullScreen ? (
          // A phone scrolls the bottom with the fields
          <DialogContent>
            {children}
            <DialogActions
              className="dialogActionsFluid"
              sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 3 }}
            >
              {footer}
            </DialogActions>
          </DialogContent>
        ) : (
          <>
            <DialogContent>{children}</DialogContent>
            <DialogActions>{footer}</DialogActions>
          </>
        )}
      </Box>
    </Dialog>
  )
}

const ROW_SX = {
  display: 'grid',
  gridTemplateColumns: '112px minmax(0, 1fr)',
  columnGap: '12px',
  alignItems: 'start',
  mt: '12px',
  '&:first-of-type': { mt: 0 }
} as const

const PHONE_ROW_SX = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  mt: '24px',
  '&:first-of-type': { mt: 0 }
} as const

const LABEL_SX = {
  pt: '11px',
  typography: 'body1',
  color: 'text.primary'
} as const

const PHONE_LABEL_SX = { ...LABEL_SX, pt: 0 } as const

export interface FormFieldRowProps {
  label: ReactNode
  /** The id of the field the label names; none for a group */
  htmlFor?: string
  /** The id of the label, for a field named by `aria-labelledby` */
  labelId?: string
  /** The label over the field (phones) */
  isStacked?: boolean
  children: ReactNode
}

/** A field of `FormDialogFrame` and its label */
export function FormFieldRow({
  label,
  htmlFor,
  labelId,
  isStacked = false,
  children
}: FormFieldRowProps): ReactElement {
  return (
    <Box sx={isStacked ? PHONE_ROW_SX : ROW_SX}>
      <Box
        component={htmlFor === undefined ? 'span' : 'label'}
        id={labelId}
        htmlFor={htmlFor}
        sx={isStacked ? PHONE_LABEL_SX : LABEL_SX}
      >
        {label}
      </Box>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  )
}
