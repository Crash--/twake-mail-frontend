// Upstream to twake-ui: yes. A modal that holds a picker (a filter field and
// its list): a centred dialog on desktop and tablets, a sheet rising from the
// bottom edge on phones, with a title and a close button in both. twake-mui's
// `Dialog` is always centred and its `Drawer` has no title.
import { Cross, Icon } from '@linagora/twake-icons'
import {
  Box,
  Dialog,
  DialogContent,
  Drawer,
  IconButton,
  Tooltip
} from '@linagora/twake-mui'
import { useId, type ReactElement, type ReactNode } from 'react'

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
  const header = (
    <Box className="u-flex u-flex-items-center u-ph-1 u-pt-half">
      <Box
        component="h2"
        id={titleId}
        className="u-flex-auto"
        sx={{ typography: 'h6', m: 0, px: 1 }}
      >
        {title}
      </Box>
      <Tooltip title={closeLabel}>
        <IconButton
          aria-label={closeLabel}
          onClick={onClose}
          data-testid={closeButtonTestId}
        >
          <Icon icon={Cross} aria-hidden="true" />
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
        paper: { 'data-testid': testId }
      }}
    >
      {header}
      <DialogContent>{children}</DialogContent>
    </Dialog>
  )
}
