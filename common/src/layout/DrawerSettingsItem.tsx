import { Setting } from '@linagora/twake-icons'
import { Box } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { Link } from 'react-router'

import { NavTree } from '@/ds/NavTree/NavTree'
import { NavTreeItem } from '@/ds/NavTreeItem/NavTreeItem'
import { SETTINGS_PATH } from '@common/features/settings/sections'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'
import { Icon } from '@/ds/Icon/Icon'

/**
 * The settings at the foot of the folder drawer of a phone, under the
 * labels. None in a mailbox delegated to the user: its settings are the
 * owner's.
 */
export function DrawerSettingsItem(): ReactElement | null {
  const { t } = useI18n()
  const isDelegated = useJmapSession().view.kind === 'delegated'
  if (isDelegated) return null
  const label = t('settings.title')

  return (
    <Box component="nav" aria-label={label} className="u-mt-1">
      <NavTree>
        <NavTreeItem
          level={1}
          icon={<Icon icon={Setting} />}
          label={label}
          linkComponent={Link}
          to={SETTINGS_PATH}
          data-testid="settings-button"
        />
      </NavTree>
    </Box>
  )
}
