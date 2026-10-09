import { Box, Button, Popover, TextField } from '@linagora/twake-mui'
import {
  useState,
  type SubmitEvent,
  type MouseEvent,
  type ReactElement
} from 'react'

import {
  Account,
  AllEmail,
  Attachment,
  Calendar,
  CalendarToday,
  Email,
  FolderOutlined,
  LabelOutlined,
  MoveFolderContent,
  SelectedCheck,
  StarOutline
} from '@/ds/FlutterIcons/FlutterIcons'
import { ChoiceMenu } from '@/ds/ChoiceMenu/ChoiceMenu'
import { FilterChip } from '@/ds/FilterChip/FilterChip'
import { ScrollRow } from '@/ds/ScrollRow/ScrollRow'
import { useLabels, useLabelsAvailable } from '@common/features/labels/queries'
import { usePickFolderOrChoice } from '@common/features/mailbox/MailboxPickerProvider'
import { useI18n } from '@common/i18n/useI18n'

import {
  DATE_RANGES,
  DEFAULT_SORT_ORDER,
  EMPTY_SEARCH_FILTER,
  isEmptySearch,
  type SearchFilter
} from './searchFilter'
import { DATE_LABELS } from './searchLabels'
import { useMailboxOptions } from './useMailboxOptions'

type MenuName = 'labels' | 'date'

/** The scopes listed before the folders; not mailbox ids: they hold a space */
const DEFAULT_SCOPE_ID = 'all email'
const EVERYWHERE_SCOPE_ID = 'all email trash spam'
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
 * filter of a folder, as in tmail-flutter: folder, senders and
 * recipients (removable), date, attachment, starred, unread and order. Each
 * change runs the search again; "Clear filter" keeps the order only.
 */
export function SearchFiltersBar({
  filter,
  onChange,
  trailing
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
  const pickFolderOrChoice = usePickFolderOrChoice()
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
    }
  }

  // As tmail-flutter: the destination picker, "All email" and "All Email,
  // trash & spam" before the folders, the current scope marked
  const pickScope = (): void => {
    setIsPickingFolder(true)
    pickFolderOrChoice({
      title: t('search.selectFolder'),
      currentLabel: t('search.scope.selected'),
      currentId:
        scope.kind === 'mailbox'
          ? scope.mailboxId
          : scope.kind === 'everywhere'
            ? EVERYWHERE_SCOPE_ID
            : DEFAULT_SCOPE_ID,
      choices: [
        {
          id: DEFAULT_SCOPE_ID,
          label: t('search.scope.default'),
          icon: AllEmail
        },
        {
          id: EVERYWHERE_SCOPE_ID,
          label: t('search.scope.everywhere'),
          icon: MoveFolderContent
        }
      ]
    })
      .then(picked => {
        setIsPickingFolder(false)
        if (picked === null) return
        if ('icon' in picked) {
          onChange({
            ...filter,
            scope: {
              kind: picked.id === EVERYWHERE_SCOPE_ID ? 'everywhere' : 'default'
            }
          })
          return
        }
        onChange({
          ...filter,
          scope: { kind: 'mailbox', mailboxId: picked.id }
        })
      })
      .catch((error: unknown) => {
        setIsPickingFolder(false)
        console.warn('[search] Cannot pick the folder', error)
      })
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

  const handleAddress = (event: SubmitEvent<HTMLFormElement>): void => {
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
          selectedIcon={SelectedCheck}
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
          selectedIcon={SelectedCheck}
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
          selectedIcon={SelectedCheck}
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
      <ChoiceMenu
        anchorEl={menu?.anchor ?? null}
        onClose={closeMenu}
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
