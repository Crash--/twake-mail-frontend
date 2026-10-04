import {
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { Cross, Icon } from '@linagora/twake-icons'
import { useId, type ChangeEvent, type ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useI18n } from '@common/i18n/useI18n'

import { SHORTCUTS } from './shortcuts'
import { useShortcutsEnabled } from './shortcutsSetting'

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
  const [isEnabled, setEnabled] = useShortcutsEnabled()
  const closeLabel = t('common.close')

  const handleToggle = (event: ChangeEvent<HTMLInputElement>): void => {
    setEnabled(event.target.checked)
  }

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
        <div id={descriptionId}>
          <SecondaryText variant="body2" component="p">
            {t('shortcuts.description')}
          </SecondaryText>
        </div>
        <FormControlLabel
          className="u-mv-1"
          control={
            <Switch
              checked={isEnabled}
              onChange={handleToggle}
              data-testid="shortcuts-enabled-switch"
            />
          }
          label={t('shortcuts.enable')}
        />
        <Table size="small" aria-labelledby={titleId}>
          <TableHead>
            <TableRow>
              <TableCell>
                <Typography variant="subtitle2" color="textPrimary">
                  {t('shortcuts.key')}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" color="textPrimary">
                  {t('shortcuts.action')}
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {SHORTCUTS.map(shortcut => (
              <TableRow key={shortcut.key}>
                <TableCell>
                  <Typography
                    component="kbd"
                    variant="body2"
                    color="textPrimary"
                    className="u-fw-bold"
                  >
                    {shortcut.key}
                  </Typography>
                </TableCell>
                <TableCell>
                  {/* The theme greys table cells below AA contrast
                      (docs/twake-mui-gaps.md) */}
                  <Typography variant="body2" color="textPrimary">
                    {t(shortcut.label)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  )
}
