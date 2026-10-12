import type { IconProps } from '@linagora/twake-icons'
import { Box } from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

import { CategoryTabs } from '@/ds/CategoryTabs/CategoryTabs'
import {
  MessageCategory,
  NavigationCategory,
  ReadingCategory
} from '@/ds/FlutterIcons/ShortcutCategoryIcons'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { SettingsSubheading } from '@/ds/SettingsHeading/SettingsHeading'
import { SettingsSwitchRow } from '@/ds/SettingsOption/SettingsOption'
import { ShortcutList } from '@/ds/ShortcutList/ShortcutList'
import { useI18n } from '@common/i18n/useI18n'

import {
  COMPOSER_SHORTCUTS,
  modifierKeyName,
  SHORTCUT_CATEGORIES,
  SHORTCUTS,
  type ShortcutCategory
} from './shortcuts'
import { useShortcutsEnabled } from './shortcutsSetting'

/** tmail-flutter's icons of the categories, on phones and tablets */
const CATEGORY_ICONS: Record<ShortcutCategory, IconProps['icon']> = {
  navigation: NavigationCategory,
  reading: ReadingCategory,
  management: MessageCategory
}

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
  // As tmail-flutter: one tab per category
  const [category, setCategory] = useState<ShortcutCategory>('navigation')

  return (
    <>
      <div id={descriptionId}>
        <SecondaryText variant="body2" component="p" className="u-mb-1">
          {t('shortcuts.description')}
        </SecondaryText>
      </div>
      <SettingsSwitchRow
        title={t('shortcuts.enable')}
        isChecked={isEnabled}
        onChange={setEnabled}
        data-testid="shortcuts-enabled-switch"
      />
      <Box className="u-mt-1">
        <CategoryTabs
          tabs={SHORTCUT_CATEGORIES.map(tab => ({
            id: tab.id,
            label: t(tab.label),
            shortLabel: t(tab.shortLabel),
            icon: CATEGORY_ICONS[tab.id]
          }))}
          value={category}
          onChange={id => {
            setCategory(id as ShortcutCategory)
          }}
          label={t('shortcuts.categories.label')}
          data-testid="shortcuts-categories"
        >
          <ShortcutList
            labelledBy={labelledBy}
            actionHeader={t('shortcuts.action')}
            keyHeader={t('shortcuts.key')}
            rows={SHORTCUTS.filter(
              shortcut => shortcut.category === category
            ).map(shortcut => ({
              keys: shortcut.keys ?? shortcut.key,
              label: t(shortcut.label)
            }))}
          />
        </CategoryTabs>
      </Box>
      <SettingsSubheading id={composerTitleId} component="h3">
        {t('shortcuts.composerTitle')}
      </SettingsSubheading>
      <ShortcutList
        labelledBy={composerTitleId}
        actionHeader={t('shortcuts.action')}
        keyHeader={t('shortcuts.key')}
        rows={COMPOSER_SHORTCUTS.map(shortcut => ({
          keys: shortcut.keys.replace('Mod', modifier),
          label: t(shortcut.label)
        }))}
      />
    </>
  )
}
