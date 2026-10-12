// Upstream to twake-ui: no, the look of tmail-flutter's form dialogs
// (`IdentityCreatorFormDesktopBuilder`, `IdentityCreatorFormMobileBuilder`):
// on a desktop and a tablet a white card at most 784 px wide, rounded by
// 16 px, over the page dimmed at 20 %, the title in the middle in Semi Bold
// 24, a grey close cross at the top end, the fields with their label in a
// 112 px column before them, and at the bottom an option at the start and
// the buttons at the end; on a phone the whole screen, a bar with the arrow
// back and the title in the middle, the labels over the fields. Its fields
// are tmail-flutter's: 40 px high, rounded by 10 px, a light grey outline,
// blue once focused, grey filled when they cannot change.
import { Icon } from '@linagora/twake-icons'
import {
  Box,
  Dialog,
  IconButton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type { ReactElement, ReactNode, SubmitEvent } from 'react'

import { ArrowBack, CloseDialog } from '@/ds/FlutterIcons/FlutterIcons'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

const TEXT_COLOR = TMAIL.textOnSurface

/** The fields of tmail-flutter's forms, and their label */
const FIELDS_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: TMAIL.surface,
    fontSize: 14,
    lineHeight: '18px',
    color: TEXT_COLOR
  },
  '& .MuiOutlinedInput-input': {
    height: '18px',
    py: '11px',
    px: '12px'
  },
  '& .MuiOutlinedInput-input::placeholder': {
    color: TMAIL.greyPlaceholder,
    opacity: 1
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: TMAIL.divider12
  },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: TMAIL.outline24
  },
  '&& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: TMAIL.primary,
    borderWidth: '1px'
  },
  '&& .MuiOutlinedInput-root.Mui-error': { bgcolor: TMAIL.redPale },
  '&& .MuiOutlinedInput-root.Mui-error .MuiOutlinedInput-notchedOutline': {
    borderColor: TMAIL.errorLogin
  },
  '&& .MuiOutlinedInput-root.Mui-disabled': { bgcolor: TMAIL.fillF4 },
  '&& .MuiOutlinedInput-root.Mui-disabled .MuiOutlinedInput-notchedOutline': {
    borderColor: TMAIL.outline
  },
  '& .MuiOutlinedInput-input.Mui-disabled': {
    color: TEXT_COLOR,
    WebkitTextFillColor: TEXT_COLOR
  },
  '& .MuiFormHelperText-root': {
    mx: 0,
    fontSize: 13,
    lineHeight: '16px'
  },
  // The theme pads the icons of checkboxes by 3 px: tmail-flutter's box
  // fills its 20 px
  '&& .MuiCheckbox-root svg.twake-icon': {
    width: 20,
    height: 20,
    padding: 0,
    boxSizing: 'border-box'
  },
  '& .MuiCheckbox-root': { color: TMAIL.greyFaint },
  '& .MuiCheckbox-root.Mui-checked': { color: TMAIL.primary },
  '& .MuiFormControlLabel-label': {
    fontSize: 14,
    lineHeight: '18px',
    color: TEXT_COLOR
  }
} as const

function paperSx(isFullScreen: boolean): Record<string, unknown> {
  return isFullScreen
    ? { ...FIELDS_SX, m: 0, borderRadius: 0, bgcolor: TMAIL.surface }
    : {
        ...FIELDS_SX,
        position: 'relative',
        // Over the sizes of twake-mui's dialogs
        '&&': { width: 784, maxWidth: 'calc(100% - 48px)', m: 3 },
        borderRadius: '16px',
        boxShadow: '0 2px 24px rgba(0, 0, 0, 0.08), 0 0 2px rgba(0, 0, 0, 0.08)'
      }
}

const TITLE_SX = {
  px: 4,
  pt: 3,
  pb: '12px',
  textAlign: 'center',
  fontSize: 24,
  fontWeight: 600,
  lineHeight: '32px',
  color: TEXT_COLOR,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

/** The bar of a phone: 64 px, the arrow back, the title in the middle */
const PHONE_BAR_SX = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  height: 64,
  px: '50px'
} as const

const PHONE_TITLE_SX = {
  fontSize: 16,
  fontWeight: 400,
  lineHeight: '24px',
  color: TEXT_COLOR,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

function bodySx(isFullScreen: boolean): Record<string, unknown> {
  return {
    flex: '1 1 auto',
    overflowY: 'auto',
    px: isFullScreen ? '17px' : 4,
    pt: isFullScreen ? 1 : 0,
    pb: isFullScreen ? 0 : 3
  }
}

function footerSx(isFullScreen: boolean): Record<string, unknown> {
  return isFullScreen
    ? {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '44px',
        px: '17px',
        pt: 1,
        pb: 3,
        '& > .FormDialogFrame-actions': { width: '100%' },
        '& > .FormDialogFrame-actions > *': { flex: '1 1 0' }
      }
    : {
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pl: 4,
        pr: '37px',
        pt: '12px',
        pb: 3
      }
}

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

/** A form in a dialog, as tmail-flutter's */
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
      fullScreen={isFullScreen}
      maxWidth={false}
      aria-labelledby={titleId}
      slotProps={{
        paper: { sx: paperSx(isFullScreen) },
        backdrop: { sx: { bgcolor: 'rgba(0, 0, 0, 0.2)' } }
      }}
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
          <Box sx={PHONE_BAR_SX}>
            <Box sx={{ position: 'absolute', left: 4, top: 8 }}>
              <Tooltip title={closeLabel}>
                <IconButton
                  aria-label={closeLabel}
                  onClick={onClose}
                  sx={{ color: TEXT_COLOR }}
                >
                  <Icon icon={ArrowBack} size={24} />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography id={titleId} component="h2" sx={PHONE_TITLE_SX}>
              {title}
            </Typography>
          </Box>
        ) : (
          <>
            <Typography id={titleId} component="h2" sx={TITLE_SX}>
              {title}
            </Typography>
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
          </>
        )}
        {isFullScreen ? (
          // A phone scrolls the bottom with the fields, as tmail-flutter
          <Box sx={bodySx(true)}>
            {children}
            <Box sx={{ ...footerSx(true), px: 0 }}>{footer}</Box>
          </Box>
        ) : (
          <>
            <Box sx={bodySx(false)}>{children}</Box>
            <Box sx={footerSx(false)}>{footer}</Box>
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
  fontSize: 14,
  lineHeight: '18px',
  fontWeight: 400,
  color: TMAIL.textBlack
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
