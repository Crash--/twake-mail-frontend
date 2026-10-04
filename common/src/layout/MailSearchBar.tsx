import { SearchBar } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

/**
 * Search field of the top bar. Placeholder until the search lands.
 */
export function MailSearchBar(): ReactElement {
  const { t } = useI18n()

  return (
    <SearchBar
      size="medium"
      placeholder={t('topbar.searchPlaceholder')}
      className="u-w-100 u-maw-7"
      data-testid="search-bar"
      componentsProps={{
        inputBase: { inputProps: { 'data-testid': 'search-input' } }
      }}
    />
  )
}
