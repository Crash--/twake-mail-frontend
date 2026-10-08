import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip
} from '@linagora/twake-mui'
import { Icon } from '@linagora/twake-icons'
import { useId, type ReactElement } from 'react'

import { Cross } from '@/ds/FlutterIcons/FlutterIcons'
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="medium"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-testid="shortcuts-dialog"
    >
      <DialogTitle id={titleId} className="u-flex u-flex-items-center">
        <span className="u-flex-auto">{t('shortcuts.title')}</span>
        <Tooltip title={closeLabel}>
          <IconButton
            aria-label={closeLabel}
            onClick={onClose}
            data-testid="shortcuts-dialog-close-button"
          >
            <Icon icon={Cross} />
          </IconButton>
        </Tooltip>
      </DialogTitle>
      <DialogContent>
        <ShortcutsPanel descriptionId={descriptionId} labelledBy={titleId} />
      </DialogContent>
    </Dialog>
  )
}
