import type { TranslationKey } from '@common/i18n/useI18n'

import type { DateRange, SortOrder } from './searchFilter'

/** Translation keys of the date ranges */
export const DATE_LABELS: Readonly<Record<DateRange, TranslationKey>> = {
  allTime: 'search.dates.allTime',
  last7Days: 'search.dates.last7Days',
  last30Days: 'search.dates.last30Days',
  last6Months: 'search.dates.last6Months',
  lastYear: 'search.dates.lastYear',
  custom: 'search.dates.custom'
}

/** Translation keys of the orders */
export const SORT_LABELS: Readonly<Record<SortOrder, TranslationKey>> = {
  relevance: 'search.sort.relevance',
  mostRecent: 'search.sort.mostRecent',
  oldest: 'search.sort.oldest',
  senderAscending: 'search.sort.senderAscending',
  senderDescending: 'search.sort.senderDescending',
  subjectAscending: 'search.sort.subjectAscending',
  subjectDescending: 'search.sort.subjectDescending',
  sizeAscending: 'search.sort.sizeAscending',
  sizeDescending: 'search.sort.sizeDescending'
}
