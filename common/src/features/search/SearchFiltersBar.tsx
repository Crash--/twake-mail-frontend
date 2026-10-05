import { Box, Button, Chip, Menu, MenuItem } from '@linagora/twake-mui'
import { useState, type MouseEvent, type ReactElement } from 'react'

import { useI18n } from '@common/i18n/useI18n'

import { FilterChip } from './FilterChip'
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

type MenuName = 'folder' | 'date' | 'sort'

interface MenuChoice {
  key: string
  label: string
  isSelected: boolean
  apply: () => void
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

  const canClear = !isEmptySearch(filter) || filter.sort !== DEFAULT_SORT_ORDER

  return (
    <Box
      role="toolbar"
      aria-label={t('search.filtersBar')}
      className="u-flex u-flex-auto u-flex-wrap u-flex-items-center"
      data-testid="search-filters-bar"
    >
      <span className="u-mr-half u-mb-half">
        <FilterChip
          label={scopeLabel}
          isSelected={scope.kind !== 'default'}
          hasMenu
          isExpanded={menu?.name === 'folder'}
          onClick={openMenu('folder')}
          data-testid="search-filter-folder"
        />
      </span>
      {removable.map(item => (
        <span key={item.key} className="u-mr-half u-mb-half">
          <Chip
            label={item.label}
            color="primary"
            onClick={item.remove}
            onDelete={item.remove}
            aria-label={t('search.removeFilter', { name: item.label })}
            data-testid="search-filter-removable"
          />
        </span>
      ))}
      <span className="u-mr-half u-mb-half">
        <FilterChip
          label={dateLabel}
          isSelected={filter.dateRange !== 'allTime'}
          hasMenu
          isExpanded={menu?.name === 'date'}
          onClick={openMenu('date')}
          data-testid="search-filter-date-time"
        />
      </span>
      <span className="u-mr-half u-mb-half">
        <FilterChip
          label={t('search.filters.hasAttachment')}
          isSelected={filter.hasAttachment}
          onClick={() => {
            onChange({ ...filter, hasAttachment: !filter.hasAttachment })
          }}
          data-testid="search-filter-has-attachment"
        />
      </span>
      <span className="u-mr-half u-mb-half">
        <FilterChip
          label={t('search.filters.starred')}
          isSelected={filter.starred}
          onClick={() => {
            onChange({ ...filter, starred: !filter.starred })
          }}
          data-testid="search-filter-starred"
        />
      </span>
      <span className="u-mr-half u-mb-half">
        <FilterChip
          label={t('search.filters.unread')}
          isSelected={filter.unread}
          onClick={() => {
            onChange({ ...filter, unread: !filter.unread })
          }}
          data-testid="search-filter-unread"
        />
      </span>
      <span className="u-mr-half u-mb-half">
        <FilterChip
          label={t(SORT_LABELS[filter.sort])}
          isSelected={filter.sort !== DEFAULT_SORT_ORDER}
          hasMenu
          isExpanded={menu?.name === 'sort'}
          onClick={openMenu('sort')}
          data-testid="search-filter-sort-by"
        />
      </span>
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
