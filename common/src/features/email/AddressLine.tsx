import { Dropdown, Dropup } from '@linagora/twake-icons'
import type { EmailAddress } from 'jmap-client-ts'
import type { ReactElement } from 'react'

import { IconAction } from '@/ds/IconAction/IconAction'
import { InlineGroup } from '@/ds/InlineGroup/InlineGroup'
import { MessageText } from '@/ds/MessageText/MessageText'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import { formatAddress, formatAddressName } from './addresses'
import { EmailAddressCard } from './EmailAddressCard'

export interface AddressLineProps {
  label: TranslationKey
  addresses: readonly EmailAddress[] | null
  /**
   * `compact`: "To Name", the names as buttons of their address menu and a
   * chevron showing every address (an open email); `full`: "To: Name
   * <address>" in text (a message of a conversation)
   */
  variant?: 'compact' | 'full'
  /** `compact`: shows the addresses as well as the names */
  isOpen?: boolean
  /** `compact`: the chevron showing them, null for none */
  onToggle?: (() => void) | null
  'data-testid': string
}

function CompactAddressLine({
  label,
  addresses,
  isOpen = false,
  onToggle = null,
  'data-testid': testId
}: Omit<AddressLineProps, 'addresses' | 'variant'> & {
  addresses: readonly EmailAddress[]
}): ReactElement {
  const { t } = useI18n()
  const toggleLabel = t(
    isOpen ? 'email.hideRecipients' : 'email.showRecipients'
  )
  const toggle =
    onToggle === null ? null : (
      <IconAction
        label={toggleLabel}
        // A 16 px chevron in an 18 px button, as high as a line of
        // addresses, in the secondary text colour
        icon={isOpen ? Dropup : Dropdown}
        iconSize={16}
        size={18}
        isInline
        tone="secondary"
        aria-expanded={isOpen}
        onClick={onToggle}
        data-testid="email-view-recipients-toggle"
      />
    )
  // One wrapping row: the addresses start on the line of the label and go
  // to the next line one by one
  return (
    <InlineGroup gap={0.5} data-testid={testId}>
      <MessageText variant="label">{`${t(label)}:`}</MessageText>
      {addresses.map((address, index) => {
        const isLast = index === addresses.length - 1
        const recipient = (
          <MessageText
            key={`${address.email}-${index}`}
            variant="recipient"
            className={isLast && toggle !== null ? undefined : 'u-mr-half'}
          >
            <EmailAddressCard address={address}>
              {isOpen ? formatAddress(address) : formatAddressName(address)}
            </EmailAddressCard>
            {isLast ? null : ','}
          </MessageText>
        )
        // The chevron goes along with the last address, even to the next
        // line, rather than on a line of its own
        return isLast && toggle !== null ? (
          <InlineGroup
            key={`${address.email}-${index}`}
            gap={0.5}
            component="span"
            isWrapping={false}
          >
            {recipient}
            {toggle}
          </InlineGroup>
        ) : (
          recipient
        )
      })}
    </InlineGroup>
  )
}

/** A line of recipients of an email: "To Name ⌄" */
export function AddressLine({
  label,
  addresses,
  variant = 'compact',
  isOpen,
  onToggle,
  'data-testid': testId
}: AddressLineProps): ReactElement | null {
  const { t } = useI18n()
  if (!addresses || addresses.length === 0) return null
  if (variant === 'compact') {
    return (
      <CompactAddressLine
        label={label}
        addresses={addresses}
        isOpen={isOpen}
        onToggle={onToggle}
        data-testid={testId}
      />
    )
  }
  return (
    <MessageText variant="recipient" component="p" data-testid={testId}>
      <MessageText variant="label">{`${t(label)}: `}</MessageText>
      {addresses.map((address, index) => (
        <span key={`${address.email}-${index}`}>
          {index > 0 ? ', ' : null}
          <EmailAddressCard address={address} isInline>
            {formatAddress(address)}
          </EmailAddressCard>
        </span>
      ))}
    </MessageText>
  )
}
