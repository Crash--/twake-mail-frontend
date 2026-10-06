import {
  Account,
  Attachment,
  Calendar,
  CalendarToday,
  Email,
  FolderOutlined,
  LabelOutlined,
  StarOutline
} from '@linagora/twake-icons'
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Popover,
  TextField
} from '@linagora/twake-mui'
import {
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactElement
} from 'react'

import { FilterChip } from '@/ds/FilterChip/FilterChip'
import { useLabels, useLabelsAvailable } from '@common/features/labels/queries'
import { useI18n } from '@common/i18n/useI18n'

import {
  DATE_RANGES,
  DEFAULT_SORT_ORDER,
  EMPTY_SEARCH_FILTER,
  isEmptySearch,
  SORT_ORDERS,
  type SearchFilter
} from './searchFilter'
import { DATE_LABELS, SORT_LABELS } from './searchLabels'
import { storeSortOrder } from './searchStorage'
import { useMailboxOptions } from './useMailboxOptions'

type MenuName = 'folder' | 'labels' | 'date' | 'sort'
type AddressField = 'from' | 'to'

interface MenuChoice {
  key: string
  label: string
  isSelected: boolean
  apply: () => void
}

/** A chip and the space around it, for when the bar wraps */
function Slot({ children }: { children: ReactElement }): ReactElement {
  return <span className="u-mr-half u-mb-half">{children}</span>
}

export interface SearchFiltersBarProps {
  filter: SearchFilter
  /** Runs the search with the changed filter */
  onChange: (filter: SearchFilter) => void
}

/**
 * The filters of the list toolbar while a search runs, in place of the
 * filter of a folder, as in tmail-flutter: folder, senders and
 * recipients (removable), date, attachment, starred, unread and order. Each
 * change runs the search again; "Clear filter" keeps the order only.
 */
export function SearchFiltersBar({
  filter,
  onChange
}: SearchFiltersBarProps): ReactElement {
  const { t } = useI18n()
  const mailboxes = useMailboxOptions()
  const labelsAvailable = useLabelsAvailable()
  const labelList = useLabels().data?.list
  const labels = labelsAvailable ? (labelList ?? []) : []
  const [address, setAddress] = useState<{
    field: AddressField
    anchor: HTMLElement
    value: string
  } | null>(null)
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
  const scopeLabel =
    scope.kind === 'mailbox'
      ? (mailboxes.find(mailbox => mailbox.id === scope.mailboxId)?.name ??
        t('search.fields.folder'))
      : t(
          scope.kind === 'everywhere'
            ? 'search.scope.everywhere'
            : 'search.scope.default'
        )
  const dateLabel =
    filter.dateRange === 'custom' &&
    filter.startDate !== null &&
    filter.endDate !== null
      ? t('search.dates.range', {
          startDate: filter.startDate,
          endDate: filter.endDate
        })
      : t(DATE_LABELS[filter.dateRange])

  const choices = (name: MenuName): MenuChoice[] => {
    switch (name) {
      case 'folder':
        return [
          {
            key: 'default',
            label: t('search.scope.default'),
            isSelected: scope.kind === 'default',
            apply: () => {
              onChange({ ...filter, scope: { kind: 'default' } })
            }
          },
          {
            key: 'everywhere',
            label: t('search.scope.everywhere'),
            isSelected: scope.kind === 'everywhere',
            apply: () => {
              onChange({ ...filter, scope: { kind: 'everywhere' } })
            }
          },
          ...mailboxes.map(mailbox => ({
            key: mailbox.id,
            label: mailbox.label,
            isSelected:
              scope.kind === 'mailbox' && scope.mailboxId === mailbox.id,
            apply: () => {
              onChange({
                ...filter,
                scope: { kind: 'mailbox', mailboxId: mailbox.id }
              })
            }
          }))
        ]
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
            label: label.displayName,
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
      case 'sort':
        return SORT_ORDERS.map(order => ({
          key: order,
          label: t(SORT_LABELS[order]),
          isSelected: filter.sort === order,
          apply: () => {
            storeSortOrder(order)
            onChange({ ...filter, sort: order })
          }
        }))
    }
  }

  const removable = [
    ...filter.from.map(value => ({
      key: `from:${value}`,
      label: `${t('search.fields.from')}: ${value}`,
      remove: () => {
        onChange({
          ...filter,
          from: filter.from.filter(item => item !== value)
        })
      }
    })),
    ...filter.to.map(value => ({
      key: `to:${value}`,
      label: `${t('search.fields.to')}: ${value}`,
      remove: () => {
        onChange({ ...filter, to: filter.to.filter(item => item !== value) })
      }
    })),
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

  const labelName =
    labels.find(label => label.keyword === filter.label)?.displayName ??
    t('search.labels.all')

  const handleAddress = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (address === null) return
    const value = address.value.trim()
    if (value !== '' && !filter[address.field].includes(value)) {
      onChange({
        ...filter,
        [address.field]: [...filter[address.field], value]
      })
    }
    setAddress(null)
  }

  const canClear = !isEmptySearch(filter) || filter.sort !== DEFAULT_SORT_ORDER

  return (
    <Box
      role="toolbar"
      aria-label={t('search.filtersBar')}
      className="u-flex u-flex-auto u-flex-wrap u-flex-items-center"
      data-testid="search-filters-bar"
    >
      <Slot>
        <FilterChip
          label={scopeLabel}
          icon={FolderOutlined}
          isSelected={scope.kind !== 'default'}
          popup="menu"
          isExpanded={menu?.name === 'folder'}
          onClick={openMenu('folder')}
          data-testid="search-filter-folder"
        />
      </Slot>
      {labelsAvailable ? (
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
            label={t(`search.fields.${field}`)}
            icon={Account}
            isSelected={filter[field].length > 0}
            popup="dialog"
            isExpanded={address?.field === field}
            onClick={event => {
              setAddress({ field, anchor: event.currentTarget, value: '' })
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
          icon={Calendar}
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
          icon={Email}
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
      <Slot>
        <FilterChip
          label={t(SORT_LABELS[filter.sort])}
          isSelected={filter.sort !== DEFAULT_SORT_ORDER}
          popup="menu"
          isExpanded={menu?.name === 'sort'}
          onClick={openMenu('sort')}
          data-testid="search-filter-sort-by"
        />
      </Slot>
      {canClear ? (
        <Button
          variant="text"
          size="small"
          className="u-mb-half"
          onClick={() => {
            onChange({ ...EMPTY_SEARCH_FILTER, sort: filter.sort })
          }}
          data-testid="search-clear-filter-button"
        >
          {t('search.clearFilter')}
        </Button>
      ) : null}
      <Popover
        open={address !== null}
        anchorEl={address?.anchor ?? null}
        onClose={() => {
          setAddress(null)
        }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label':
              address === null ? undefined : t(`search.fields.${address.field}`)
          }
        }}
        data-testid="search-filter-address-popover"
      >
        {address === null ? null : (
          <Box
            component="form"
            className="u-flex u-flex-items-center u-p-1"
            onSubmit={handleAddress}
          >
            <TextField
              autoFocus
              size="small"
              label={t(`search.fields.${address.field}`)}
              placeholder={t('search.hints.address')}
              value={address.value}
              onChange={event => {
                setAddress({ ...address, value: event.target.value })
              }}
              slotProps={{
                htmlInput: { 'data-testid': 'search-filter-address-input' }
              }}
            />
            <Button
              type="submit"
              variant="contained"
              size="small"
              className="u-ml-half"
              disabled={address.value.trim() === ''}
              data-testid="search-filter-address-add-button"
            >
              {t('search.addFilter')}
            </Button>
          </Box>
        )}
      </Popover>
      <Menu
        open={menu !== null}
        anchorEl={menu?.anchor ?? null}
        onClose={closeMenu}
        data-testid="search-filter-menu"
      >
        {(menu === null ? [] : choices(menu.name)).map(choice => (
          <MenuItem
            key={choice.key}
            role="menuitemradio"
            aria-checked={choice.isSelected}
            selected={choice.isSelected}
            onClick={() => {
              closeMenu()
              choice.apply()
            }}
          >
            {choice.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}
