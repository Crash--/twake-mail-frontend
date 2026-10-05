import { Button, Link } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

import { toSafePaywallUrl } from './paywallUrl'
import { usePremiumCta } from './usePremiumCta'

export interface UpgradeStorageLinkProps {
  label: string
  /** `link` in a sentence, `button` as a call to action */
  appearance?: 'link' | 'button'
  className?: string
  'data-testid': string
}

/**
 * The way to the paywall, when the user can upgrade the storage: a link
 * opening it in a new tab, cut from the page (`noopener`) and from the
 * referrer. Nothing without a safe URL; the URL is checked once more here,
 * where it reaches the DOM.
 */
export function UpgradeStorageLink({
  label,
  appearance = 'link',
  className,
  'data-testid': testId
}: UpgradeStorageLinkProps): ReactElement | null {
  const { t } = useI18n()
  const cta = usePremiumCta()
  const url = cta.status === 'available' ? toSafePaywallUrl(cta.url) : null
  if (url === null) return null

  const accessibleName = `${label} (${t('common.opensInNewTab')})`
  const linkProps = {
    href: url,
    target: '_blank',
    rel: 'noopener noreferrer',
    referrerPolicy: 'no-referrer',
    className,
    'aria-label': accessibleName,
    'data-testid': testId
  } as const
  return appearance === 'button' ? (
    <Button variant="contained" {...linkProps}>
      {label}
    </Button>
  ) : (
    <Link {...linkProps}>{label}</Link>
  )
}
