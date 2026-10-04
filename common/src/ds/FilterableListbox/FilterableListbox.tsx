// Upstream to twake-ui: yes. A filter field driving a list that is always
// shown (a picker in a dialog: folder, address book, calendar), with the
// ARIA 1.2 combobox pattern; MUI `Autocomplete` only knows a popup list.
import { Icon, type IconProps } from '@linagora/twake-icons'
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography
} from '@linagora/twake-mui'
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactElement
} from 'react'

export interface FilterableListboxOption {
  id: string
  label: string
  /** Shown under the label while filtering, e.g. the path of a folder */
  secondary?: string | null
  /** Indentation, from 1, while not filtering */
  level?: number
  icon?: IconProps['icon']
  /** Shown, not selectable (e.g. the folder the email is already in) */
  disabled?: boolean
}

export interface FilterableListboxProps {
  options: readonly FilterableListboxOption[]
  onSelect: (option: FilterableListboxOption) => void
  /** Label and placeholder of the filter field */
  filterLabel: string
  /** Accessible name of the list */
  listLabel: string
  /** Shown when no option matches */
  emptyLabel: string
  testIds?: { input?: string; listbox?: string; option?: string }
}

const LEVEL_SX = (level: number): object => ({ pl: 2 + (level - 1) * 2 })
const LIST_SX = { maxHeight: '50vh', overflowY: 'auto' } as const

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase()
}

/**
 * A filter field and the list of options it filters, always shown: the
 * focus stays in the field (`role="combobox"`), ArrowDown / ArrowUp move
 * the active option (`aria-activedescendant`), Enter or a click selects it.
 * Disabled options stay listed, announced as such, and are skipped.
 */
export function FilterableListbox({
  options,
  onSelect,
  filterLabel,
  listLabel,
  emptyLabel,
  testIds = {}
}: FilterableListboxProps): ReactElement {
  const id = useId()
  const listboxId = `${id}-listbox`
  const [filter, setFilter] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const isFiltering = filter.trim() !== ''
  const shown = useMemo(() => {
    const words = normalize(filter).split(/\s+/).filter(Boolean)
    return words.length === 0
      ? options
      : options.filter(option => {
          const text = normalize(`${option.label} ${option.secondary ?? ''}`)
          return words.every(word => text.includes(word))
        })
  }, [options, filter])
  const enabled = shown.filter(option => option.disabled !== true)
  const active =
    enabled.find(option => option.id === activeId) ?? enabled[0] ?? null
  const optionId = (option: FilterableListboxOption): string =>
    `${id}-option-${option.id}`

  useEffect(() => {
    if (active === null) return
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: 'nearest' })
    // optionId only depends on the stable id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const move = (delta: number): void => {
    if (enabled.length === 0) return
    const index = active === null ? -1 : enabled.indexOf(active)
    const next = (index + delta + enabled.length) % enabled.length
    setActiveId(enabled[next]?.id ?? null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter' && active !== null) {
      event.preventDefault()
      onSelect(active)
    }
  }

  return (
    <Box>
      <TextField
        autoFocus
        fullWidth
        size="small"
        label={filterLabel}
        value={filter}
        onChange={event => {
          setFilter(event.target.value)
          setActiveId(null)
        }}
        slotProps={{
          htmlInput: {
            role: 'combobox',
            'aria-expanded': true,
            'aria-controls': listboxId,
            'aria-autocomplete': 'list',
            'aria-activedescendant':
              active === null ? undefined : optionId(active),
            autoComplete: 'off',
            onKeyDown: handleKeyDown,
            'data-testid': testIds.input
          }
        }}
      />
      <List
        id={listboxId}
        role="listbox"
        aria-label={listLabel}
        dense
        sx={LIST_SX}
        data-testid={testIds.listbox}
      >
        {shown.map(option => {
          const isActive = option === active
          const isDisabled = option.disabled === true
          return (
            <ListItemButton
              key={option.id}
              id={optionId(option)}
              component="li"
              role="option"
              aria-selected={isActive}
              aria-disabled={isDisabled || undefined}
              // The focus stays in the field: the list is not in the tab
              // order, a click selects without moving the focus
              tabIndex={-1}
              selected={isActive}
              disabled={isDisabled}
              onMouseDown={event => {
                event.preventDefault()
              }}
              onClick={() => {
                if (!isDisabled) onSelect(option)
              }}
              sx={isFiltering ? undefined : LEVEL_SX(option.level ?? 1)}
              data-testid={testIds.option}
              data-option-id={option.id}
            >
              {option.icon ? (
                <ListItemIcon>
                  <Icon icon={option.icon} />
                </ListItemIcon>
              ) : null}
              <ListItemText
                primary={option.label}
                secondary={isFiltering ? option.secondary : null}
              />
            </ListItemButton>
          )
        })}
      </List>
      {shown.length === 0 ? (
        <Typography role="status" variant="body2" className="u-p-1">
          {emptyLabel}
        </Typography>
      ) : null}
    </Box>
  )
}
