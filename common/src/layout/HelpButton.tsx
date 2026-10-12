import { Icon } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { useMatch } from 'react-router'

import { HelpOutlined } from '@/ds/FlutterIcons/FlutterIcons'
import { TMAIL } from '@/ds/TmailColors/tmailColors'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { SETTINGS_PATH } from '@common/features/settings/sections'
import { useContactSupport } from '@common/features/support/useContactSupport'
import { useI18n } from '@common/i18n/useI18n'

/** tmail-flutter's `AppColor.messageDialogColor` (#8C9CAF) */
const FLUTTER_HELP_COLOR = TMAIL.steelLight

/**
 * "Get help or report a bug" of the top bar, as tmail-flutter: only when the
 * server tells where to ask (`com:linagora:params:jmap:contact:support`). A
 * support address opens a message to it (a `mailto:` link in the settings,
 * which have no composer), a web address opens in a new tab.
 */
export interface HelpButtonProps {
  /**
   * tmail-flutter's bar (without the platform): its 24 px icon in
   * `messageDialogColor`, 8 px before the next action
   */
  isFlutterLook?: boolean
}

export function HelpButton({
  isFlutterLook = false
}: HelpButtonProps): ReactElement | null {
  const { t } = useI18n()
  const { openComposer } = useComposer()
  const isSettings = useMatch(`${SETTINGS_PATH}/*`) !== null
  const support = useContactSupport()
  if (support === null) return null
  const address = support.kind === 'address' ? support.address : null
  const link = support.kind === 'link' ? support.href : null
  const label = t('topbar.help')

  const common = {
    'aria-label': label,
    className: isFlutterLook ? 'u-mr-half' : undefined,
    'data-testid': 'help-button'
  } as const
  const icon = isFlutterLook ? (
    <Icon icon={HelpOutlined} size={24} color={FLUTTER_HELP_COLOR} />
  ) : (
    <Icon icon={HelpOutlined} />
  )
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
        {icon}
      </IconButton>
    )
  } else if (isSettings) {
    button = (
      <IconButton {...common} component="a" href={`mailto:${address}`}>
        {icon}
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
        {icon}
      </IconButton>
    )
  }
  return <Tooltip title={label}>{button}</Tooltip>
}
