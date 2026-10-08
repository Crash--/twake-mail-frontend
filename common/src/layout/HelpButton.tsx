import { Icon } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import {
  LINAGORA_CAPABILITIES,
  type ContactSupportCapability
} from 'jmap-client-ts/linagora'
import type { ReactElement } from 'react'
import { useMatch } from 'react-router'

import { HelpOutlined } from '@/ds/FlutterIcons/FlutterIcons'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { SETTINGS_PATH } from '@common/features/settings/sections'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? null : trimmed
}

/**
 * "Get help or report a bug" of the top bar, as tmail-flutter: only when the
 * server tells where to ask (`com:linagora:params:jmap:contact:support`). A
 * support address opens a message to it (a `mailto:` link in the settings,
 * which have no composer), a web address opens in a new tab.
 */
export function HelpButton(): ReactElement | null {
  const { t } = useI18n()
  const { session } = useJmapSession()
  const { openComposer } = useComposer()
  const isSettings = useMatch(`${SETTINGS_PATH}/*`) !== null
  const support = session.capabilities[LINAGORA_CAPABILITIES.contactSupport] as
    ContactSupportCapability | undefined
  const address = clean(support?.supportMailAddress)
  const link = clean(support?.httpLink)
  if (address === null && link === null) return null
  const label = t('topbar.help')

  const common = {
    'aria-label': label,
    'data-testid': 'help-button'
  } as const
  let button: ReactElement
  if (address === null) {
    button = (
      <IconButton
        {...common}
        component="a"
        href={link ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Icon icon={HelpOutlined} />
      </IconButton>
    )
  } else if (isSettings) {
    button = (
      <IconButton {...common} component="a" href={`mailto:${address}`}>
        <Icon icon={HelpOutlined} />
      </IconButton>
    )
  } else {
    button = (
      <IconButton
        {...common}
        onClick={() => {
          openComposer({
            mailto: {
              to: [address],
              cc: [],
              bcc: [],
              subject: null,
              body: null
            }
          })
        }}
      >
        <Icon icon={HelpOutlined} />
      </IconButton>
    )
  }
  return <Tooltip title={label}>{button}</Tooltip>
}
