// Upstream to twake-ui: no, the contact view opened by the "From" and "To"
// filters of a search: a dialog (the whole screen of a phone) with a title
// bar and a close button, a filled search field, the contacts (avatar, name,
// address, a checkbox at the end) divided by lines, and "Clear filter" and
// "Done" at the end. twake-mui has no such picker.
//
// Accessibility: a dialog named by its title; the contacts are checkboxes
// (`role="checkbox"`, `aria-checked`) in a list the search field controls;
// the focus goes to the search field and back to what opened it.
import { Icon, Cross, Magnifier, CrossCircle } from '@linagora/twake-icons'
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  IconButton,
  InputBase,
  radius,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useId, useRef, type ReactElement } from 'react'

import { CheckboxOff, CheckboxOn } from '@/ds/FlutterIcons/FlutterIcons'
import {
  firstLetterOf,
  GradientAvatar
} from '@/ds/GradientAvatar/GradientAvatar'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

function paperSx(isPhone: boolean): Record<string, unknown> {
  return isPhone
    ? { borderRadius: `${radius.lg} ${radius.lg} 0 0`, m: 0 }
    : {
        width: 558,
        maxWidth: 'calc(100% - 32px)',
        height: 'min(624px, 100dvh)',
        maxHeight: '100dvh',
        m: 0
      }
}

const BAR_SX = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  height: 56,
  px: '56px'
} as const

const TITLE_SX = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
} as const

const CLOSE_SX = {
  position: 'absolute',
  right: 16,
  top: '50%',
  transform: 'translateY(-50%)'
} as const

const SEARCH_SX = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  height: 40,
  mx: 2,
  my: 1,
  borderRadius: radius.pill,
  bgcolor: 'background.default',
  color: 'text.secondary',
  '& .MuiInputBase-root': { flex: '1 1 auto' },
  // Its own clear button only
  '& .MuiInputBase-input::-webkit-search-cancel-button': { display: 'none' }
} as const

const SEARCH_ICON_SX = { display: 'flex', mx: 2 } as const

const CLEAR_SX = { mr: 1 } as const

const LIST_SX = {
  flex: '1 1 auto',
  overflowY: 'auto',
  listStyle: 'none',
  m: 0,
  p: 0,
  '& > li + li::before': {
    content: '""',
    display: 'block',
    height: '1px',
    mx: '16px',
    bgcolor: 'divider'
  }
} as const

const ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  width: '100%',
  px: 2,
  py: 1,
  textAlign: 'start',
  '&:hover': { bgcolor: 'action.hover' }
} as const

const TEXT_SX = { flex: '1 1 auto', minWidth: 0 } as const

const NAME_SX = {
  display: 'block',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

const ADDRESS_SX = {
  display: 'block',
  color: 'text.secondary',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

function checkboxSx(isChecked: boolean): Record<string, unknown> {
  return {
    display: 'flex',
    flexShrink: 0,
    mx: 1.5,
    color: isChecked ? 'primary.main' : 'text.secondary'
  }
}

const FOOTER_SX = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '12px',
  flexShrink: 0,
  p: '16px'
} as const

const BUTTON_SX = {
  minWidth: 156,
  flex: '0 1 auto',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
} as const

export interface ContactPickerItem {
  address: string
  /** Shown above the address; null for an address alone */
  name: string | null
}

export interface ContactPickerLabels {
  title: string
  close: string
  /** Placeholder and name of the search field */
  search: string
  clearSearch: string
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
    close?: string
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
  const id = useId()
  const titleId = `${id}-title`
  const listId = `${id}-list`
  const isPhone = useScreenSize() === 'mobile'
  const inputRef = useRef<HTMLInputElement>(null)
  const chosen = new Set(selected.map(address => address.toLowerCase()))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isPhone}
      disableAutoFocus
      slotProps={{
        paper: { sx: paperSx(isPhone) },
        transition: {
          onEntered: () => {
            inputRef.current?.focus()
          }
        }
      }}
      aria-labelledby={titleId}
      data-testid={testIds.dialog}
    >
      <Box sx={BAR_SX}>
        <Typography
          id={titleId}
          component="h2"
          variant="h4"
          color="text.primary"
          sx={TITLE_SX}
        >
          {labels.title}
        </Typography>
        <Tooltip title={labels.close}>
          <IconButton
            aria-label={labels.close}
            onClick={onClose}
            sx={CLOSE_SX}
            data-testid={testIds.close}
          >
            <Icon icon={Cross} size={24} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={SEARCH_SX}>
        <Box component="span" sx={SEARCH_ICON_SX}>
          <Icon icon={Magnifier} size={20} aria-hidden="true" />
        </Box>
        <InputBase
          inputRef={inputRef}
          type="search"
          placeholder={labels.search}
          value={query}
          onChange={event => {
            onQueryChange(event.target.value)
          }}
          inputProps={{
            'aria-label': labels.search,
            'aria-controls': listId,
            autoComplete: 'off',
            spellCheck: false,
            'data-testid': testIds.input
          }}
        />
        {query === '' ? null : (
          <Tooltip title={labels.clearSearch}>
            <IconButton
              size="small"
              aria-label={labels.clearSearch}
              onClick={() => {
                onQueryChange('')
                inputRef.current?.focus()
              }}
              sx={CLEAR_SX}
            >
              <Icon icon={CrossCircle} size={16} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Box component="ul" id={listId} aria-label={labels.list} sx={LIST_SX}>
        {items.map(item => {
          const isChecked = chosen.has(item.address.toLowerCase())
          const label = item.name ?? item.address
          return (
            <Box component="li" key={item.address}>
              <ButtonBase
                role="checkbox"
                aria-checked={isChecked}
                onClick={() => {
                  onToggle(item)
                }}
                sx={ROW_SX}
                data-testid={testIds.item}
              >
                <GradientAvatar
                  text={firstLetterOf(label)}
                  colorKey={item.address}
                  size={40}
                />
                <Box component="span" sx={TEXT_SX}>
                  <Typography component="span" variant="body1" sx={NAME_SX}>
                    {label}
                  </Typography>
                  {item.name === null ? null : (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={ADDRESS_SX}
                    >
                      {item.address}
                    </Typography>
                  )}
                </Box>
                <Box component="span" sx={checkboxSx(isChecked)}>
                  <Icon
                    icon={isChecked ? CheckboxOn : CheckboxOff}
                    size={20}
                    aria-hidden="true"
                  />
                </Box>
              </ButtonBase>
            </Box>
          )
        })}
      </Box>
      <Box sx={FOOTER_SX}>
        <Button
          variant="text"
          onClick={onClearFilter}
          sx={BUTTON_SX}
          data-testid={testIds.clearFilter}
        >
          {labels.clearFilter}
        </Button>
        <Button
          variant="contained"
          onClick={onDone}
          sx={BUTTON_SX}
          data-testid={testIds.done}
        >
          {labels.done}
        </Button>
      </Box>
    </Dialog>
  )
}
