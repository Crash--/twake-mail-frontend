import { Link } from '@linagora/twake-mui'
import type { EmailAddress } from '@linagora/jmap-client-ts'
import { LINAGORA_CAPABILITIES } from '@linagora/jmap-client-ts/linagora'
import {
  useState,
  type DragEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref
} from 'react'
import { useNavigate } from 'react-router'

import {
  ContactCard,
  type ContactCardAction
} from '@/ds/ContactCard/ContactCard'
import { useComposer } from '@common/features/composer/ComposerProvider'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import type { NewRuleLocationState } from '@common/features/rules/EmailRulesSettings'
import { settingsSectionPath } from '@common/features/settings/sections'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { writeAddressDrag } from './addressDrag'
import { addressDisplayName } from './addresses'

export interface EmailAddressCardProps {
  address: EmailAddress
  /** What the address shows: its name, its email */
  children: ReactNode
  /**
   * In running text (a line of recipients): a `mailto:` link that opens the
   * card, not a button, which would never break across lines with the text
   */
  isInline?: boolean
  /** The button opening the card, for another way to open it (the avatar) */
  buttonRef?: Ref<HTMLButtonElement>
}

function AddressCardDialog({
  address,
  anchorEl,
  onClose
}: {
  address: EmailAddress
  anchorEl: HTMLElement | null
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { notify } = useNotify()
  const { openComposer } = useComposer()
  const { session } = useJmapSession()
  const hasRules = LINAGORA_CAPABILITIES.filter in session.capabilities
  const name = addressDisplayName(address)

  const handleClose = onClose

  const handleCopy = (): void => {
    notify({ message: t('email.address.copied'), severity: 'success' })
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

  // As tmail-flutter: "Create a rule with this email", then "Compose
  // email", the main action, last
  const actions: ContactCardAction[] = []
  if (hasRules) {
    actions.push({
      id: 'create-rule',
      label: t('email.address.createRule'),
      onClick: handleCreateRule,
      'data-testid': 'email-address-create-rule-item'
    })
  }
  actions.push({
    id: 'compose',
    label: t('email.address.compose'),
    isPrimary: true,
    onClick: handleCompose,
    'data-testid': 'email-address-compose-item'
  })
  return (
    <ContactCard
      anchorEl={anchorEl}
      onClose={onClose}
      name={name}
      address={address.email}
      onCopy={handleCopy}
      actions={actions}
      data-testid="email-address-card"
    />
  )
}

/**
 * An address of an email header, as a button opening its contact card next
 * to it (twake-mui's `ContactCard`): the avatar, the name, the address with
 * a button copying it, and the actions "Compose email" and, when the server
 * has filtering rules, "Create a rule with this email".
 *
 * The address can be dragged to a recipient field of a message being
 * written, which adds it there.
 */
export function EmailAddressCard({
  address,
  children,
  isInline = false,
  buttonRef
}: EmailAddressCardProps): ReactElement {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  // Mounted at the first opening: a long conversation has many addresses
  const [hasOpened, setHasOpened] = useState(false)

  const handleOpen = (event: MouseEvent<HTMLElement>): void => {
    // A link: the card, not the mail program
    event.preventDefault()
    setHasOpened(true)
    setAnchorEl(event.currentTarget)
  }

  const handleClose = (): void => {
    setAnchorEl(null)
  }

  const handleDragStart = (event: DragEvent<HTMLElement>): void => {
    writeAddressDrag(event.dataTransfer, address)
  }

  const opener = {
    color: 'inherit',
    underline: 'hover',
    className: 'u-ta-left',
    'aria-haspopup': 'dialog',
    'aria-expanded': anchorEl !== null,
    onClick: handleOpen,
    draggable: true,
    onDragStart: handleDragStart,
    'data-testid': 'email-address',
    children
  } as const

  return (
    <>
      {isInline ? (
        <Link href={`mailto:${address.email}`} {...opener} />
      ) : (
        <Link component="button" type="button" ref={buttonRef} {...opener} />
      )}
      {hasOpened ? (
        <AddressCardDialog
          address={address}
          anchorEl={anchorEl}
          onClose={handleClose}
        />
      ) : null}
    </>
  )
}
