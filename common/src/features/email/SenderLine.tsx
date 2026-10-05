import { Link, Typography } from '@linagora/twake-mui'
import type { EmailAddress } from 'jmap-client-ts'
import type { ReactElement } from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useI18n } from '@common/i18n/useI18n'

import { formatAddressName } from './addresses'
import { EmailAddressMenu } from './EmailAddressMenu'

export interface SenderLineProps {
  sender: EmailAddress | null
  /** Says "From:" first, where the name is already shown above */
  hasLabel?: boolean
  /**
   * Offers "Unsubscribe" after the address (not on phones, where it is in
   * the "More" menu, as in tmail-flutter)
   */
  onUnsubscribe?: (() => void) | null
  'data-testid': string
}

/**
 * The sender of an email, its name in bold and its address, as the button
 * of its address menu (copy, compose, "Create a rule with this email")
 */
export function SenderLine({
  sender,
  hasLabel = false,
  onUnsubscribe = null,
  'data-testid': testId
}: SenderLineProps): ReactElement {
  const { t } = useI18n()
  const isPhone = useScreenSize() === 'mobile'
  return (
    <Typography data-testid={testId}>
      {hasLabel ? (
        <SecondaryText component="span">{`${t('email.from')}: `}</SecondaryText>
      ) : null}
      {sender ? (
        <EmailAddressMenu address={sender}>
          <span className="u-fw-bold">{formatAddressName(sender)}</span>
          {sender.name ? (
            <SecondaryText component="span">{` <${sender.email}>`}</SecondaryText>
          ) : null}
        </EmailAddressMenu>
      ) : null}
      {onUnsubscribe !== null && !isPhone ? (
        <>
          {' '}
          <Link
            component="button"
            type="button"
            color="inherit"
            underline="always"
            onClick={onUnsubscribe}
            data-testid="email-unsubscribe-link"
          >
            {t('unsubscribe.action')}
          </Link>
        </>
      ) : null}
    </Typography>
  )
}
