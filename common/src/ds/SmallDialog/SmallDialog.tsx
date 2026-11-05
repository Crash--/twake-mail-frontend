// Upstream to twake-ui: yes, as the look of its `ConfirmDialog`. twake-mui's
// `ConfirmDialog` in the frame of the Figma "small modal": a short text and
// its actions, no line between them, the header and the actions of the
// other dialogs (`ModalDialog`).
import { ConfirmDialog } from '@linagora/twake-mui'
import type { ComponentProps, ReactElement } from 'react'

import { smallDialogPaperSx } from '@/ds/ModalDialog/modalDialogSx'

export type SmallDialogProps = ComponentProps<typeof ConfirmDialog>

/** A short question or message and its actions; takes `ConfirmDialog`'s props */
export function SmallDialog({
  slotProps,
  ...props
}: SmallDialogProps): ReactElement {
  return (
    <ConfirmDialog
      {...props}
      slotProps={{ ...slotProps, paper: { sx: smallDialogPaperSx } }}
    />
  )
}
