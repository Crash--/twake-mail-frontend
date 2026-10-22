import {
  EmailNotification,
  FolderOutlined,
  LabelOutlined,
  StarOutline,
  Attachment,
  CalendarToday,
  Check,
  Account
} from '@linagora/twake-icons'
import { Button } from '@linagora/twake-mui'
import { useState, type MouseEvent, type ReactElement } from 'react'

import { ChoiceMenu } from '@/ds/ChoiceMenu/ChoiceMenu'
import { formatDayText } from '@/ds/DateRangePicker/calendarDays'
import { FilterChip } from '@/ds/FilterChip/FilterChip'
import { ScrollRow } from '@/ds/ScrollRow/ScrollRow'
import { labelDisplayName } from '@common/features/labels/labelDisplayName'
import { useLabels, useLabelsAvailable } from '@common/features/labels/queries'
import { useI18n } from '@common/i18n/useI18n'

import {
  DATE_RANGES,
  DEFAULT_SORT_ORDER,
  EMPTY_SEARCH_FILTER,
  isEmptySearch,
  type SearchFilter
} from './searchFilter'
import { SearchAddressDialog } from './SearchAddressDialog'
import { DATE_LABELS } from './searchLabels'
import { usePickSearchScope, useSearchScopeLabel } from './usePickSearchScope'

type MenuName = 'labels' | 'date'

type AddressField = 'from' | 'to'

interface MenuChoice {
  key: string
  label: string
  isSelected: boolean
  apply: () => void
}

/** A chip as one child of the row: the row spaces them */
function Slot({ children }: { children: ReactElement }): ReactElement {
  return <span>{children}</span>
}

export interface SearchFiltersBarProps {
  filter: SearchFilter
  /** Runs the search with the changed filter */
  onChange: (filter: SearchFilter) => void
  /** The last chip, e.g. the order of the results */
  trailing?: ReactElement
}

/**
 * The filters of the list toolbar while a search runs, in place of the
 * filter of a folder, as in tmail-flutter: folder, senders, recipients,
 * subject and excluded words (removable), date, attachment, starred, unread
 * and order. Each change runs the search again; "Clear filter" keeps the
 * order only.
 */
export function SearchFiltersBar({
  filter,
  onChange,
  trailing
}: SearchFiltersBarProps): ReactElement {
  const { t } = useI18n()
  const scopeLabelOf = useSearchScopeLabel()
  const labelsAvailable = useLabelsAvailable()
  const labelList = useLabels().data?.list
  const labels = labelsAvailable ? (labelList ?? []) : []
  const [addressField, setAddressField] = useState<AddressField | null>(null)
  const pickSearchScope = usePickSearchScope()
  const [isPickingFolder, setIsPickingFolder] = useState(false)
  const [menu, setMenu] = useState<{
    name: MenuName
    anchor: HTMLElement
  } | null>(null)

  const openMenu =
    (name: MenuName) =>
    (event: MouseEvent<HTMLElement>): void => {
      setMenu({ name, anchor: event.currentTarget })
    }

  const closeMenu = (): void => {
    setMenu(null)
  }

  const scope = filter.scope
  const scopeLabel = scopeLabelOf(scope)
  const dateLabel =
    filter.dateRange === 'custom' &&
    filter.startDate !== null &&
    filter.endDate !== null
      ? t('search.dates.range', {
          startDate: formatDayText(filter.startDate),
          endDate: formatDayText(filter.endDate)
        })
      : t(DATE_LABELS[filter.dateRange])

  const choices = (name: MenuName): MenuChoice[] => {
    switch (name) {
      case 'labels':
        return [
          {
            key: 'all',
            label: t('search.labels.all'),
            isSelected: filter.label === null,
            apply: () => {
              onChange({ ...filter, label: null })
            }
          },
          ...labels.map(label => ({
            key: label.id,
            label: labelDisplayName(label, t),
            isSelected: filter.label === label.keyword,
            apply: () => {
              onChange({ ...filter, label: label.keyword })
            }
          }))
        ]
      case 'date':
        // A custom range is picked in the advanced search
        return DATE_RANGES.filter(range => range !== 'custom').map(range => ({
          key: range,
          label: t(DATE_LABELS[range]),
          isSelected: filter.dateRange === range,
          apply: () => {
            onChange({
              ...filter,
              dateRange: range,
              startDate: null,
              endDate: null
            })
          }
        }))
    }
  }

  // As tmail-flutter: the destination picker
  const pickScope = (): void => {
    setIsPickingFolder(true)
    pickSearchScope(scope)
      .then(picked => {
        setIsPickingFolder(false)
        if (picked !== null) onChange({ ...filter, scope: picked })
      })
      .catch((error: unknown) => {
        setIsPickingFolder(false)
        console.warn('[search] Cannot pick the folder', error)
      })
  }

  const removable = [
    ...(filter.subject === ''
      ? []
      : [
          {
            key: 'subject',
            label: `${t('search.fields.subject')}: ${filter.subject}`,
            remove: () => {
              onChange({ ...filter, subject: '' })
            }
          }
        ]),
    ...(filter.notWords.length === 0
      ? []
      : [
          {
            key: 'not',
            label: `${t('search.fields.notWords')}: ${filter.notWords.join(', ')}`,
            remove: () => {
              onChange({ ...filter, notWords: [] })
            }
          }
        ])
  ]

  // As tmail-flutter: one chip per field, naming the addresses once chosen;
  // they are removed in its dialog
  const addressLabel = (field: AddressField): string => {
    const name = t(`search.fields.${field}`)
    return filter[field].length === 0
      ? name
      : `${name}: ${filter[field].join(', ')}`
  }

  // A keyword no label has (e.g. a deleted one) still filters: say so
  const filterLabel =
    filter.label === null
      ? null
      : (labels.find(label => label.keyword === filter.label) ?? null)
  const labelName =
    filter.label === null
      ? t('search.labels.all')
      : filterLabel === null
        ? t('search.labels.unknown')
        : labelDisplayName(filterLabel, t)

  const canClear = !isEmptySearch(filter) || filter.sort !== DEFAULT_SORT_ORDER

  return (
    <ScrollRow label={t('search.filtersBar')} data-testid="search-filters-bar">
      <Slot>
        <FilterChip
          label={scopeLabel}
          icon={FolderOutlined}
          isSelected={scope.kind !== 'default'}
          popup="dialog"
          isExpanded={isPickingFolder}
          onClick={pickScope}
          data-testid="search-filter-folder"
        />
      </Slot>
      {/* As tmail-flutter: only once the account has labels */}
      {labels.length > 0 ? (
        <Slot>
          <FilterChip
            label={labelName}
            icon={LabelOutlined}
            isSelected={filter.label !== null}
            popup="menu"
            isExpanded={menu?.name === 'labels'}
            onClick={openMenu('labels')}
            data-testid="search-filter-labels"
          />
        </Slot>
      ) : null}
      {(['from', 'to'] as const).map(field => (
        <Slot key={field}>
          <FilterChip
            label={addressLabel(field)}
            icon={Account}
            isSelected={filter[field].length > 0}
            popup="dialog"
            isExpanded={addressField === field}
            onClick={() => {
              setAddressField(field)
            }}
            data-testid={`search-filter-${field}`}
          />
        </Slot>
      ))}
      {removable.map(item => (
        <Slot key={item.key}>
          <FilterChip
            label={item.label}
            isSelected
            isRemovable
            onClick={item.remove}
            aria-label={t('search.removeFilter', { name: item.label })}
            data-testid="search-filter-removable"
          />
        </Slot>
      ))}
      <Slot>
        <FilterChip
          label={dateLabel}
          icon={CalendarToday}
          isSelected={filter.dateRange !== 'allTime'}
          popup="menu"
          isExpanded={menu?.name === 'date'}
          onClick={openMenu('date')}
          data-testid="search-filter-date-time"
        />
      </Slot>
      <Slot>
        <FilterChip
          label={t('search.filters.hasAttachment')}
          icon={Attachment}
          selectedIcon={Check}
          isSelected={filter.hasAttachment}
          onClick={() => {
            onChange({ ...filter, hasAttachment: !filter.hasAttachment })
          }}
          data-testid="search-filter-has-attachment"
        />
      </Slot>
      <Slot>
        <FilterChip
          label={t('search.filters.starred')}
          icon={StarOutline}
          selectedIcon={Check}
          isSelected={filter.starred}
          onClick={() => {
            onChange({ ...filter, starred: !filter.starred })
          }}
          data-testid="search-filter-starred"
        />
      </Slot>
      <Slot>
        <FilterChip
          label={t('search.filters.unread')}
          icon={EmailNotification}
          selectedIcon={Check}
          isSelected={filter.unread}
          onClick={() => {
            onChange({ ...filter, unread: !filter.unread })
          }}
          data-testid="search-filter-unread"
        />
      </Slot>
      <Slot>
        <FilterChip
          label={t('search.filters.notIncludeEvents')}
          icon={CalendarToday}
          isSelected={filter.notIncludeEvents}
          onClick={() => {
            onChange({ ...filter, notIncludeEvents: !filter.notIncludeEvents })
          }}
          data-testid="search-filter-not-include-events"
        />
      </Slot>
      {trailing === undefined ? null : <Slot>{trailing}</Slot>}
      {canClear ? (
        <Button
          variant="text"
          size="small"
          onClick={() => {
            onChange({ ...EMPTY_SEARCH_FILTER, sort: filter.sort })
          }}
          data-testid="search-clear-filter-button"
        >
          {t('search.clearFilter')}
        </Button>
      ) : null}
      {addressField === null ? null : (
        <SearchAddressDialog
          field={addressField}
          filter={filter}
          onChange={onChange}
          onClose={() => {
            setAddressField(null)
          }}
        />
      )}
      <ChoiceMenu
        anchorEl={menu?.anchor ?? null}
        onClose={closeMenu}
        maxHeight={menu?.name === 'labels' ? 400 : undefined}
        items={(menu === null ? [] : choices(menu.name)).map(choice => ({
          key: choice.key,
          label: choice.label,
          isSelected: choice.isSelected,
          onSelect: choice.apply
        }))}
        data-testid="search-filter-menu"
      />
    </ScrollRow>
  )
}
