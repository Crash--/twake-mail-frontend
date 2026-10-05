import { Copy, Filter, Icon } from '@linagora/twake-icons'
import {
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem
} from '@linagora/twake-mui'
import type { EmailAddress } from 'jmap-client-ts'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'
import {
  useId,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode
} from 'react'
import { useNavigate } from 'react-router'

import { useNotify } from '@common/features/notifications/NotificationsProvider'
import type { NewRuleLocationState } from '@common/features/rules/EmailRulesSettings'
import { settingsSectionPath } from '@common/features/settings/sections'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

export interface EmailAddressMenuProps {
  address: EmailAddress
  /** What the address shows: its name, its email */
  children: ReactNode
}

/**
 * An address of an email header, as a button opening what can be done
 * with it, as tmail-flutter's address dialog: copy it, and "Create a rule
 * with this email" when the server has filtering rules.
 */
export function EmailAddressMenu({
  address,
  children
}: EmailAddressMenuProps): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { notify } = useNotify()
  const { session } = useJmapSession()
  const menuId = useId()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const hasRules = LINAGORA_CAPABILITIES.filter in session.capabilities

  const handleOpen = (event: MouseEvent<HTMLElement>): void => {
    setAnchor(event.currentTarget)
  }

  const handleClose = (): void => {
    setAnchor(null)
  }

  const handleCopy = (): void => {
    handleClose()
    navigator.clipboard
      .writeText(address.email)
      .then(() => {
        notify({ message: t('email.address.copied'), severity: 'success' })
      })
      .catch((error: unknown) => {
        console.warn('[email] Cannot copy the address', error)
      })
  }

  const handleCreateRule = (): void => {
    handleClose()
    void navigate(settingsSectionPath('email-rules'), {
      state: { newRuleFrom: address.email } satisfies NewRuleLocationState
    })
  }

  return (
    <>
      <Link
        component="button"
        type="button"
        color="inherit"
        underline="hover"
        className="u-ta-left"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        aria-controls={anchor === null ? undefined : menuId}
        onClick={handleOpen}
        data-testid="email-address"
      >
        {children}
      </Link>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={handleClose}
        slotProps={{
          list: {
            'aria-label': t('email.address.menu', { email: address.email })
          }
        }}
        data-testid="email-address-menu"
      >
        <MenuItem onClick={handleCopy} data-testid="email-address-copy-item">
          <ListItemIcon>
            <Icon icon={Copy} />
          </ListItemIcon>
          <ListItemText>{t('email.address.copy')}</ListItemText>
        </MenuItem>
        {hasRules ? (
          <MenuItem
            onClick={handleCreateRule}
            data-testid="email-address-create-rule-item"
          >
            <ListItemIcon>
              <Icon icon={Filter} />
            </ListItemIcon>
            <ListItemText>{t('email.address.createRule')}</ListItemText>
          </MenuItem>
        ) : null}
      </Menu>
    </>
  )
}
