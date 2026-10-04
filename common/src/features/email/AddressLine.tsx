import type { EmailAddress } from 'jmap-client-ts'
import type { ReactElement } from 'react'

import { SecondaryText } from '@/ds/SecondaryText/SecondaryText'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import { formatAddress } from './addresses'

export interface AddressLineProps {
  label: TranslationKey
  addresses: readonly EmailAddress[] | null
  'data-testid': string
}

/** A line of recipients of an email: "To: …" */
export function AddressLine({
  label,
  addresses,
  'data-testid': testId
}: AddressLineProps): ReactElement | null {
  const { t } = useI18n()
  if (!addresses || addresses.length === 0) return null
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
