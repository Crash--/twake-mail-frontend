// Upstream to twake-ui: yes. A modal that holds a picker (a filter field and
// its list): a centred dialog on desktop and tablets, a sheet rising from the
// bottom edge on phones, with a title and a close button in both. twake-mui's
// `Dialog` is always centred and its `Drawer` has no title.
import { Icon } from '@linagora/twake-icons'
import {
  Box,
  Dialog,
  DialogContent,
  Drawer,
  IconButton,
  Tooltip
} from '@linagora/twake-mui'
import { useId, type ReactElement, type ReactNode } from 'react'

import { CloseDialog, Cross } from '@/ds/FlutterIcons/FlutterIcons'
import { TMAIL } from '@/ds/TmailColors/tmailColors'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

export interface PickerSheetProps {
  open: boolean
  /** Escape, a click outside, the close button */
  onClose: () => void
  /** Visible title, and name of the dialog */
  title: string
  closeLabel: string
  children: ReactNode
  /**
   * The owner moves the focus itself on close (into what the picker
   * inserted) instead of back to what opened it
   */
  disableRestoreFocus?: boolean
  'data-testid'?: string
  closeButtonTestId?: string
}

/** tmail-flutter's modal (`ds/ModalDialog`): 554 px, rounded by 16 px */
const MODAL_PAPER_SX = {
  width: 554,
  maxWidth: 'calc(100% - 32px)',
  borderRadius: '16px',
  position: 'relative'
} as const

const MODAL_HEADER_SX = { minHeight: 64, pt: '16px', px: '56px' } as const

const MODAL_TITLE_SX = {
  m: 0,
  textAlign: 'center',
  fontSize: 24,
  fontWeight: 400,
  lineHeight: '32px',
  color: TMAIL.textOnSurface
} as const

const MODAL_CLOSE_SX = {
  position: 'absolute',
  top: 4,
  right: 4,
  p: '10px',
  color: TMAIL.steelLight
} as const

const SHEET_SX = {
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  maxHeight: '85dvh',
  pb: 'env(safe-area-inset-bottom)'
} as const

/**
 * A picker as a named modal: the focus goes in (the first control of the
 * children, a filter field), stays inside, Escape and the close button close
 * it and the focus goes back to what opened it. A sheet from the bottom on
 * phones (`aria-modal` dialog), a centred dialog elsewhere.
 */
export function PickerSheet({
  open,
  onClose,
  title,
  closeLabel,
  children,
  disableRestoreFocus = false,
  'data-testid': testId,
  closeButtonTestId
}: PickerSheetProps): ReactElement {
  const titleId = useId()
  const isPhone = useScreenSize() === 'mobile'
  // A dialog takes the frame of tmail-flutter's modals: the title in the
  // middle, the close cross at the top end
  const header = (
    <Box
      className={
        isPhone
          ? 'u-flex u-flex-items-center u-ph-1 u-pt-half'
          : 'u-flex u-flex-items-center'
      }
      sx={isPhone ? undefined : MODAL_HEADER_SX}
    >
      <Box
        component="h2"
        id={titleId}
        className="u-flex-auto"
        sx={isPhone ? { typography: 'h6', m: 0, px: 1 } : MODAL_TITLE_SX}
      >
        {title}
      </Box>
      <Tooltip title={closeLabel}>
        <IconButton
          aria-label={closeLabel}
          onClick={onClose}
          data-testid={closeButtonTestId}
          sx={isPhone ? undefined : MODAL_CLOSE_SX}
        >
          <Icon
            icon={isPhone ? Cross : CloseDialog}
            size={isPhone ? undefined : 24}
            aria-hidden="true"
          />
        </IconButton>
      </Tooltip>
    </Box>
  )

  if (isPhone) {
    return (
      <Drawer
        variant="temporary"
        anchor="bottom"
        open={open}
        onClose={onClose}
        disableRestoreFocus={disableRestoreFocus}
        // twake-mui only lifts the focus trap of `Dialog`; restated here, it
        // is what keeps the keyboard inside the sheet
        disableEnforceFocus={false}
        // Over a full-screen window (the composer on a phone), as a dialog is:
        // a drawer sits under the modal layer by default
        sx={{ zIndex: theme => theme.zIndex.modal }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-modal': true,
            'aria-labelledby': titleId,
            // @ts-expect-error data attributes are valid on the paper
            'data-testid': testId,
            sx: SHEET_SX
          }
        }}
      >
        {header}
        <Box className="u-ph-1 u-pb-1 u-ov-auto">{children}</Box>
      </Drawer>
    )
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="small"
      aria-labelledby={titleId}
      disableRestoreFocus={disableRestoreFocus}
      slotProps={{
        // @ts-expect-error data attributes are valid on the paper
        paper: { 'data-testid': testId, sx: MODAL_PAPER_SX }
      }}
    >
      {header}
      <DialogContent sx={{ px: '32px', pb: '32px' }}>{children}</DialogContent>
    </Dialog>
  )
}
