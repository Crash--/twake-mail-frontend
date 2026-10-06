import { CalendarToday, Discuss, Filter, Pen } from '@linagora/twake-icons'
import { Avatar, getInitials, Link } from '@linagora/twake-mui'
import type { EmailAddress } from 'jmap-client-ts'
import { LINAGORA_CAPABILITIES } from 'jmap-client-ts/linagora'
import { useState, type ReactElement, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import {
  ContactCard,
  type ContactCardAction
} from '@/ds/ContactCard/ContactCard'
import { useAppConfig } from '@common/config/AppConfigProvider'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import type { NewRuleLocationState } from '@common/features/rules/EmailRulesSettings'
import { settingsSectionPath } from '@common/features/settings/sections'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { contactLinks } from './contactLinks'

export interface EmailAddressCardProps {
  address: EmailAddress
  /** What the address shows: its name, its email */
  children: ReactNode
}

/**
 * An address of an email header, as a button opening its contact card, as
 * tmail-flutter's address dialog (a dialog, a bottom sheet on phones): the
 * avatar, the name, the address with a button copying it, and the actions
 * "Compose email" and, when the server has filtering rules, "Create a rule
 * with this email". As in Twake Calendar's attendees, "Invite to an event"
 * and "Chat" appear when `CALENDAR_SPA_URL` and `CHAT_SPA_URL` are set.
 */
export function EmailAddressCard({
  address,
  children
}: EmailAddressCardProps): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { notify } = useNotify()
  const { openComposer } = useComposer()
  const { session } = useJmapSession()
  const config = useAppConfig()
  const [isOpen, setIsOpen] = useState(false)
  const hasRules = LINAGORA_CAPABILITIES.filter in session.capabilities
  const name = (address.name ?? '').trim()

  const handleOpen = (): void => {
    setIsOpen(true)
  }

  const handleClose = (): void => {
    setIsOpen(false)
  }

  const handleCopy = (): void => {
    navigator.clipboard
      .writeText(address.email)
      .then(() => {
        notify({ message: t('email.address.copied'), severity: 'success' })
      })
      .catch((error: unknown) => {
        console.warn('[email] Cannot copy the address', error)
      })
  }

  const handleCompose = (): void => {
    handleClose()
    openComposer({
      mailto: {
        to: [address.email],
        cc: [],
        bcc: [],
        subject: null,
        body: null
      }
    })
  }

  const handleCreateRule = (): void => {
    handleClose()
    void navigate(settingsSectionPath('email-rules'), {
      state: { newRuleFrom: address.email } satisfies NewRuleLocationState
    })
  }

  const links = contactLinks(address.email, {
    calendarSpaUrl: config?.calendarSpaUrl ?? null,
    chatSpaUrl: config?.chatSpaUrl ?? null,
    workplaceFqdnFallback: config?.workplaceFqdnFallback ?? null,
    username: session.username
  })
  const actions: ContactCardAction[] = [
    {
      id: 'compose',
      label: t('email.address.compose'),
      icon: Pen,
      isPrimary: true,
      onClick: handleCompose,
      'data-testid': 'email-address-compose-item'
    }
  ]
  if (links.invite !== null) {
    actions.push({
      id: 'invite',
      label: t('email.address.invite'),
      icon: CalendarToday,
      href: links.invite,
      onClick: handleClose,
      'data-testid': 'email-address-invite-item'
    })
  }
  if (links.chat !== null) {
    actions.push({
      id: 'chat',
      label: t('email.address.chat'),
      icon: Discuss,
      href: links.chat,
      onClick: handleClose,
      'data-testid': 'email-address-chat-item'
    })
  }
  if (hasRules) {
    actions.push({
      id: 'create-rule',
      label: t('email.address.createRule'),
      icon: Filter,
      onClick: handleCreateRule,
      'data-testid': 'email-address-create-rule-item'
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
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={handleOpen}
        data-testid="email-address"
      >
        {children}
      </Link>
      <ContactCard
        open={isOpen}
        onClose={handleClose}
        avatar={
          <Avatar size={64} aria-hidden="true">
            {getInitials(name, address.email)}
          </Avatar>
        }
        name={name}
        address={address.email}
        copyLabel={t('email.address.copy')}
        onCopy={handleCopy}
        closeLabel={t('email.address.close')}
        actions={actions}
        data-testid="email-address-card"
      />
    </>
  )
}
