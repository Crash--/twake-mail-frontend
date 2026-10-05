import { Typography } from '@linagora/twake-mui'
import type { EmailAddress } from 'jmap-client-ts'
import type { ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useI18n } from '@common/i18n/useI18n'

import { formatAddressName } from './addresses'
import { EmailAddressMenu } from './EmailAddressMenu'

export interface SenderLineProps {
  sender: EmailAddress | null
  /** Says "From:" first, where the name is already shown above */
  hasLabel?: boolean
  'data-testid': string
}

/**
 * The sender of an email, its name in bold and its address, as the button
 * of its address menu (copy, compose, "Create a rule with this email")
 */
export function SenderLine({
  sender,
  hasLabel = false,
  'data-testid': testId
}: SenderLineProps): ReactElement {
  const { t } = useI18n()
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
    </Typography>
  )
}
