import type { Label } from 'jmap-client-ts/linagora'

import type { I18nApi } from '@common/i18n/useI18n'

/**
 * The name to show for a label: another client or the API can give one a
 * blank `displayName`, which this app's dialog refuses
 */
export function labelDisplayName(
  label: Pick<Label, 'displayName'>,
  t: I18nApi['t']
): string {
  return label.displayName.trim() === ''
    ? t('labels.unnamed')
    : label.displayName
}
