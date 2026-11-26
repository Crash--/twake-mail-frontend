// Upstream to twake-ui: no, the contact view opened by the "From" and "To"
// filters of a search, in twake-mui's `FixedDialog` (the whole screen of a
// phone): a `SearchBar`, the contacts (avatar, name, address, a checkbox at
// the end) divided by lines, and "Clear filter" and "Done" as its actions.
//
// Accessibility: a dialog named by its title; the contacts are checkboxes
// named by their row, in a list the search field controls;
// the focus goes to the search field and back to what opened it.
import {
  Button,
  Checkbox,
  FixedDialog,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  SearchBar
} from '@linagora/twake-mui'
import { useId, useRef, type ReactElement } from 'react'

import {
  firstLetterOf,
  GradientAvatar
} from '@/ds/GradientAvatar/GradientAvatar'

export interface ContactPickerItem {
  address: string
  /** Shown above the address; null for an address alone */
  name: string | null
}

export interface ContactPickerLabels {
  title: string
  /** Placeholder and name of the search field */
  search: string
  /** Name of the list of contacts */
  list: string
  clearFilter: string
  done: string
}

export interface ContactPickerDialogProps {
  open: boolean
  labels: ContactPickerLabels
  query: string
  onQueryChange: (query: string) => void
  /** The contacts listed: the ones found, or the chosen ones */
  items: readonly ContactPickerItem[]
  /** The addresses chosen */
  selected: readonly string[]
  onToggle: (item: ContactPickerItem) => void
  onClearFilter: () => void
  onDone: () => void
  onClose: () => void
  testIds?: {
    dialog?: string
    input?: string
    item?: string
    clearFilter?: string
    done?: string
  }
}

/** Asks for some contacts */
export function ContactPickerDialog({
  open,
  labels,
  query,
  onQueryChange,
  items,
  selected,
  onToggle,
  onClearFilter,
  onDone,
  onClose,
  testIds = {}
}: ContactPickerDialogProps): ReactElement {
  const listId = `${useId()}-list`
  const inputRef = useRef<HTMLInputElement>(null)
  const chosen = new Set(selected.map(address => address.toLowerCase()))

  return (
    <FixedDialog
      open={open}
      onClose={onClose}
      title={labels.title}
      // A search changes the height: the search field stays in place
      align="top"
      // The search field takes the focus once the dialog is in
      disableAutoFocus
      slotProps={{
        transition: {
          onEntered: () => {
            inputRef.current?.focus()
          }
        }
      }}
      data-testid={testIds.dialog}
      content={
        <>
          <SearchBar
            elevation={0}
            placeholder={labels.search}
            value={query}
            onChange={event => {
              onQueryChange(event.target.value)
            }}
            onClear={() => {
              onQueryChange('')
              inputRef.current?.focus()
            }}
            componentsProps={{
              inputBase: {
                inputRef,
                inputProps: {
                  'aria-controls': listId,
                  autoComplete: 'off',
                  spellCheck: false,
                  'data-testid': testIds.input
                }
              }
            }}
          />
          <List id={listId} aria-label={labels.list}>
            {items.map((item, index) => {
              const label = item.name ?? item.address
              return (
                <ListItem
                  key={item.address}
                  divider={index < items.length - 1}
                  disableGutters
                >
                  <label
                    className="u-flex u-flex-items-center u-w-100 u-c-pointer"
                    data-testid={testIds.item}
                  >
                    <ListItemAvatar>
                      <GradientAvatar
                        text={firstLetterOf(label)}
                        colorKey={item.address}
                        size={40}
                      />
                    </ListItemAvatar>
                    <ListItemText
                      primary={label}
                      secondary={item.name === null ? null : item.address}
                      slotProps={{
                        primary: { noWrap: true },
                        secondary: { noWrap: true }
                      }}
                    />
                    <Checkbox
                      checked={chosen.has(item.address.toLowerCase())}
                      onChange={() => {
                        onToggle(item)
                      }}
                    />
                  </label>
                </ListItem>
              )
            })}
          </List>
        </>
      }
      actions={
        <>
          <Button
            variant="text"
            onClick={onClearFilter}
            data-testid={testIds.clearFilter}
          >
            {labels.clearFilter}
          </Button>
          <Button
            variant="contained"
            onClick={onDone}
            data-testid={testIds.done}
          >
            {labels.done}
          </Button>
        </>
      }
    />
  )
}
