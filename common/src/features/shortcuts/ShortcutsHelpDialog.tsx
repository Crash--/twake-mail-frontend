import { StandardDialog } from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

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

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      fullScreen={false}
      title={<span id={titleId}>{t('shortcuts.title')}</span>}
      content={
        <ShortcutsPanel descriptionId={descriptionId} labelledBy={titleId} />
      }
      aria-describedby={descriptionId}
      data-testid="shortcuts-dialog"
    />
  )
}
