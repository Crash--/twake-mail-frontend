import { Icon, HelpOutlined } from '@linagora/twake-icons'
import { IconButton, Tooltip } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import { useMatch } from 'react-router'

import { useComposer } from '@common/features/composer/ComposerProvider'
import { SETTINGS_PATH } from '@common/features/settings/sections'
import { useContactSupport } from '@common/features/support/useContactSupport'
import { useI18n } from '@common/i18n/useI18n'

/** A page, opened in a new tab, or a `mailto:` link in the settings, or an action */
export type HelpAction = { label: string } & (
  { href: string; onClick?: never } | { onClick: () => void; href?: never }
)

/**
 * What "Get help or report a bug" does, null without a support: a support
 * address opens a message to it (a `mailto:` link in the settings, which
 * have no composer), a web address opens in a new tab
 */
export function useHelpAction(): HelpAction | null {
  const { t } = useI18n()
  const { openComposer } = useComposer()
  const isSettings = useMatch(`${SETTINGS_PATH}/*`) !== null
  const support = useContactSupport()
  if (support === null) return null
  const label = t('topbar.help')
  if (support.kind === 'link') return { label, href: support.href }
  const { address } = support
  if (isSettings) return { label, href: `mailto:${address}` }
  return {
    label,
    onClick: () => {
      openComposer({
        mailto: { to: [address], cc: [], bcc: [], subject: null, body: null }
      })
    }
  }
}

/**
 * "Get help or report a bug" of the bar of the mail, as tmail-flutter: only
 * when the server tells where to ask
 * (`com:linagora:params:jmap:contact:support`)
 */
export function HelpButton(): ReactElement | null {
  const action = useHelpAction()
  if (action === null) return null
  const common = {
    'aria-label': action.label,
    size: 'large',
    'data-testid': 'help-button'
  } as const
  const icon = <Icon icon={HelpOutlined} />
  const button =
    action.href === undefined ? (
      <IconButton {...common} onClick={action.onClick}>
        {icon}
      </IconButton>
    ) : (
      <IconButton
        {...common}
        component="a"
        href={action.href}
        {...(action.href.startsWith('mailto:')
          ? {}
          : { target: '_blank', rel: 'noopener noreferrer' })}
      >
        {icon}
      </IconButton>
    )
  return <Tooltip title={action.label}>{button}</Tooltip>
}
