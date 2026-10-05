import {
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from '@linagora/twake-mui'
import type { ChangeEvent, ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useI18n } from '@common/i18n/useI18n'

import { SHORTCUTS } from './shortcuts'
import { useShortcutsEnabled } from './shortcutsSetting'

export interface ShortcutsPanelProps {
  /** Id of the description, for the dialog or region showing the panel */
  descriptionId?: string
  /** Id of the heading naming the table */
  labelledBy: string
}

/**
 * The keyboard shortcuts and the switch turning them off (WCAG 2.1.4), in
 * the `?` dialog and in Settings > Keyboard shortcuts.
 */
export function ShortcutsPanel({
  descriptionId,
  labelledBy
}: ShortcutsPanelProps): ReactElement {
  const { t } = useI18n()
  const [isEnabled, setEnabled] = useShortcutsEnabled()

  const handleToggle = (event: ChangeEvent<HTMLInputElement>): void => {
    setEnabled(event.target.checked)
  }

  return (
    <>
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
      <Table size="small" aria-labelledby={labelledBy}>
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
                  {shortcut.keys ?? shortcut.key}
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
    </>
  )
}
