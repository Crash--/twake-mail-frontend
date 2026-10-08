import { useId, type ReactElement } from 'react'

import { ModalDialog } from '@/ds/ModalDialog/ModalDialog'
import { useI18n } from '@common/i18n/useI18n'

import { ShortcutsPanel } from './ShortcutsPanel'

export interface ShortcutsHelpDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * The keyboard shortcuts, and the switch turning them off (WCAG 2.1.4).
 */
export function ShortcutsHelpDialog({
  open,
  onClose
}: ShortcutsHelpDialogProps): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const descriptionId = useId()
  const closeLabel = t('common.close')

  // The frame of tmail-flutter's modals (`ds/ModalDialog`)
  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={t('shortcuts.title')}
      titleId={titleId}
      describedBy={descriptionId}
      closeLabel={closeLabel}
      width={640}
      data-testid="shortcuts-dialog"
    >
      <ShortcutsPanel descriptionId={descriptionId} labelledBy={titleId} />
    </ModalDialog>
  )
}
