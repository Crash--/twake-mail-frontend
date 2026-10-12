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
   * Offers "Unsubscribe" after the address (not on phones, where it is in
   * the "More" menu, as in tmail-flutter)
   */
  onUnsubscribe?: (() => void) | null
  /** After the sender, on the same line: the date */
  children?: ReactNode
  'data-testid': string
}

/**
 * The sender of an email, its name and its address (the name alone, larger,
 * on a phone, as tmail-flutter), as the button of its card, the
 * "Unsubscribe" button and the date, in one line that wraps
 */
export function SenderLine({
  sender,
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
          <MessageText variant={isPhone ? 'phoneName' : 'name'}>
            {formatAddressName(sender)}
          </MessageText>
          {hasName && !isPhone ? (
            <MessageText variant="address">{` <${sender.email}>`}</MessageText>
          ) : null}
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
