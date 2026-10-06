import { Dropdown, Dropup } from '@linagora/twake-icons'
import type { EmailAddress } from 'jmap-client-ts'
import type { ReactElement } from 'react'

import { IconAction } from '@/ds/IconAction/IconAction'
import { InlineGroup } from '@/ds/InlineGroup/InlineGroup'
import { MessageText } from '@/ds/MessageText/MessageText'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import { formatAddress, formatAddressName } from './addresses'
import { EmailAddressMenu } from './EmailAddressMenu'

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
  return (
    <InlineGroup gap={0.5} data-testid={testId}>
      <MessageText variant="meta">{t(label)}</MessageText>
      <InlineGroup gap={0.5} component="span" isWrapping>
        {addresses.map((address, index) => (
          <MessageText
            key={`${address.email}-${index}`}
            variant="meta"
            className="u-mr-half"
          >
            <EmailAddressMenu address={address}>
              {isOpen ? formatAddress(address) : formatAddressName(address)}
            </EmailAddressMenu>
            {index < addresses.length - 1 ? ',' : null}
          </MessageText>
        ))}
      </InlineGroup>
      {onToggle !== null ? (
        <IconAction
          label={toggleLabel}
          icon={isOpen ? Dropup : Dropdown}
          iconSize={16}
          aria-expanded={isOpen}
          onClick={onToggle}
          data-testid="email-view-recipients-toggle"
        />
      ) : null}
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
    <SecondaryText variant="body2" component="p" data-testid={testId}>
      {t(label)}:{' '}
      {addresses.map((address, index) => (
        <span key={`${address.email}-${index}`} title={address.email}>
          {index > 0 ? ', ' : null}
          {formatAddress(address)}
        </span>
      ))}
    </SecondaryText>
  )
}
