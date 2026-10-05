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
import { useId, type ChangeEvent, type ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useI18n } from '@common/i18n/useI18n'

import { COMPOSER_SHORTCUTS, modifierKeyName, SHORTCUTS } from './shortcuts'
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
  const composerTitleId = useId()
  const modifier = modifierKeyName(navigator.userAgent)

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
      <ShortcutsTable
        labelledBy={labelledBy}
        rows={SHORTCUTS.map(shortcut => ({
          keys: shortcut.keys ?? shortcut.key,
          label: t(shortcut.label)
        }))}
      />
      <Typography
        id={composerTitleId}
        variant="subtitle1"
        component="h3"
        color="textPrimary"
        className="u-mt-1"
      >
        {t('shortcuts.composerTitle')}
      </Typography>
      <ShortcutsTable
        labelledBy={composerTitleId}
        rows={COMPOSER_SHORTCUTS.map(shortcut => ({
          keys: shortcut.keys.replace('Mod', modifier),
          label: t(shortcut.label)
        }))}
      />
    </>
  )
}

interface ShortcutsTableProps {
  /** Id of the heading naming the table */
  labelledBy: string
  rows: { keys: string; label: string }[]
}

/** A group of shortcuts: the keys, and what they do */
function ShortcutsTable({
  labelledBy,
  rows
}: ShortcutsTableProps): ReactElement {
  const { t } = useI18n()
  return (
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
        {rows.map(row => (
          <TableRow key={row.keys}>
            <TableCell>
              <Typography
                component="kbd"
                variant="body2"
                color="textPrimary"
                className="u-fw-bold"
              >
                {row.keys}
              </Typography>
            </TableCell>
            <TableCell>
              {/* The theme greys table cells below AA contrast
                  (docs/twake-mui-gaps.md) */}
              <Typography variant="body2" color="textPrimary">
                {row.label}
              </Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
