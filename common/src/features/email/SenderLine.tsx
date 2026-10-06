import type { EmailAddress } from 'jmap-client-ts'
import type { ReactElement, ReactNode } from 'react'

import { InlineGroup } from '@/ds/InlineGroup/InlineGroup'
import { InlineTextButton } from '@/ds/InlineTextButton/InlineTextButton'
import { MessageText } from '@/ds/MessageText/MessageText'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { useI18n } from '@common/i18n/useI18n'

import { formatAddressName } from './addresses'
import { EmailAddressCard } from './EmailAddressCard'

export interface SenderLineProps {
  sender: EmailAddress | null
  /**
   * `full`: the name in bold, then the address (an open email); `address`:
   * the address alone, where the name is already shown above (a message of
   * a conversation)
   */
  variant?: 'full' | 'address'
  /**
   * Offers "Unsubscribe" after the address (not on phones, where it is in
   * the "More" menu, as in tmail-flutter)
   */
  onUnsubscribe?: (() => void) | null
  /** After the sender, on the same line: the date */
  children?: ReactNode
  'data-testid': string
}

/**
 * The sender of an email, its name and its address, as the button of its
 * address menu (copy, compose, "Create a rule with this email"), the
 * "Unsubscribe" button and the date, in one line that wraps
 */
export function SenderLine({
  sender,
  variant = 'full',
  onUnsubscribe = null,
  children,
  'data-testid': testId
}: SenderLineProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  const hasName = (sender?.name ?? '').trim() !== ''
  return (
    <InlineGroup gap={1} data-testid={testId}>
      {sender ? (
        <EmailAddressCard address={sender}>
          {variant === 'full' ? (
            <>
              <MessageText variant="name">
                {formatAddressName(sender)}
              </MessageText>
              {hasName ? (
                <MessageText variant="address">{` <${sender.email}>`}</MessageText>
              ) : null}
            </>
          ) : (
            <MessageText variant="meta">{`<${sender.email}>`}</MessageText>
          )}
        </EmailAddressCard>
      ) : null}
      {onUnsubscribe !== null && !isPhone ? (
        <InlineTextButton
          isUnderlined
          onClick={onUnsubscribe}
          data-testid="email-unsubscribe-link"
        >
          {t('unsubscribe.action')}
        </InlineTextButton>
      ) : null}
      {children}
    </InlineGroup>
  )
}
