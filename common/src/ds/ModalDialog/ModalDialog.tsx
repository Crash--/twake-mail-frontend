// Upstream to twake-ui: yes, as the look of its `FixedDialog`. twake-mui's
// `FixedDialog` in the frame of the Figma (`modalDialogSx`): the same
// header, close button and actions in every dialog of the app.
import { FixedDialog } from '@linagora/twake-mui'
import { mergeSlotProps } from '@mui/material/utils'
import type { ComponentProps, ReactElement } from 'react'

import { modalDialogPaperSx } from './modalDialogSx'

export type ModalDialogProps = ComponentProps<typeof FixedDialog>

/**
 * A dialog with a title, a content that scrolls and actions, lines between
 * them; twake-mui's `FixedDialog`, whose props it takes
 */
export function ModalDialog({
  slotProps,
  ...props
}: ModalDialogProps): ReactElement {
  return (
    <FixedDialog
      {...props}
      slotProps={{
        ...slotProps,
        paper: mergeSlotProps(slotProps?.paper, { sx: modalDialogPaperSx })
      }}
    />
  )
}
