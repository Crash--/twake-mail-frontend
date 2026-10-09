// Upstream to twake-ui: no, the look of tmail-flutter's contact view
// (`ContactView`, opened by the "From" and "To" filters of a search): a
// white card 558 x 624 px at most, rounded by 16 px (the whole screen of a
// phone, rounded at the top), a 56 px bar with the title centred in Bold 20
// and the close cross at the end on a pale grey disc, a filled grey search
// field rounded by 12 px, the contacts (40 px gradient avatar, the name in
// Semi Bold 15, the address in grey 13 under it, a 20 px checkbox at the
// end) divided by 1 px lines, and "Clear filter" and "Done", 44 px buttons
// rounded by 10 px, at the end. twake-mui has no such picker.
//
// Accessibility: a dialog named by its title; the contacts are checkboxes
// (`role="checkbox"`, `aria-checked`) in a list the search field controls;
// the focus goes to the search field and back to what opened it.
import { Icon } from '@linagora/twake-icons'
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  IconButton,
  InputBase,
  Tooltip,
  Typography
} from '@mui/material'
import { useId, useRef, type ReactElement } from 'react'

import {
  CheckboxOff,
  CheckboxOn,
  ClearTextSearch,
  Cross,
  Magnifier
} from '@/ds/FlutterIcons/FlutterIcons'
import {
  GradientAvatar,
  firstLetterOf
} from '@/ds/GradientAvatar/GradientAvatar'
import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

const PRIMARY = TMAIL.primary
/** `AppColor.colorHintSearchBar`, `colorCloseButton` */
const HINT = TMAIL.grey
/** `AppColor.colorDivider` */
const DIVIDER = TMAIL.divider

function paperSx(isPhone: boolean): Record<string, unknown> {
  return isPhone
    ? { borderRadius: '16px 16px 0 0', m: 0 }
    : {
        width: 558,
        maxWidth: 'calc(100% - 32px)',
        height: 'min(624px, 100dvh)',
        maxHeight: '100dvh',
        m: 0,
        borderRadius: '16px'
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
  fontSize: 20,
  fontWeight: 700,
  lineHeight: '28px',
  color: TMAIL.textBlack,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
} as const

const CLOSE_SX = {
  position: 'absolute',
  right: 16,
  top: '50%',
  transform: 'translateY(-50%)',
  p: '3px',
  color: HINT,
  bgcolor: 'rgba(129, 140, 153, 0.12)',
  '&:hover': { bgcolor: 'rgba(129, 140, 153, 0.2)' }
} as const

const SEARCH_SX = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  height: 48,
  mx: '16px',
  my: '10px',
  borderRadius: '12px',
  bgcolor: TMAIL.fillToolbar,
  color: HINT,
  '& .MuiInputBase-root': {
    flex: '1 1 auto',
    fontSize: 15,
    color: TMAIL.textBlack
  },
  '& .MuiInputBase-input::placeholder': { color: HINT, opacity: 1 },
  // Its own clear button only
  '& .MuiInputBase-input::-webkit-search-cancel-button': { display: 'none' }
} as const

const SEARCH_ICON_SX = { display: 'flex', mx: '16px' } as const

const CLEAR_SX = { mx: '8px', p: '8px', color: TMAIL.greyIcon } as const

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
    bgcolor: DIVIDER
  }
} as const

const ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: '100%',
  px: '16px',
  py: '11px',
  textAlign: 'start',
  '&:hover': { bgcolor: TMAIL.hoverBlack }
} as const

const TEXT_SX = { flex: '1 1 auto', minWidth: 0 } as const

const NAME_SX = {
  display: 'block',
  fontSize: 15,
  fontWeight: 600,
  lineHeight: '20px',
  color: TMAIL.textBlack,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

const ADDRESS_SX = {
  display: 'block',
  mt: '2px',
  fontSize: 13,
  lineHeight: '18px',
  color: TMAIL.greySlate,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

function checkboxSx(isChecked: boolean): Record<string, unknown> {
  return {
    display: 'flex',
    flexShrink: 0,
    mx: '12px',
    color: isChecked ? PRIMARY : TMAIL.greyFaint
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
  height: 40,
  flex: '0 1 auto',
  borderRadius: '10px',
  fontSize: 17,
  fontWeight: 500,
  textTransform: 'none',
  boxShadow: 'none',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
} as const

const CLEAR_FILTER_SX = {
  ...BUTTON_SX,
  color: PRIMARY,
  bgcolor: 'rgba(28, 61, 13, 0.05)',
  '&:hover': { bgcolor: 'rgba(28, 61, 13, 0.1)' }
} as const

const DONE_SX = {
  ...BUTTON_SX,
  color: '#FFFFFF',
  bgcolor: PRIMARY,
  '&:hover': { bgcolor: '#0062CC', boxShadow: 'none' }
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

/** Asks for some contacts, as tmail-flutter's contact view */
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
        <Typography id={titleId} component="h2" sx={TITLE_SX}>
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
              <Icon icon={ClearTextSearch} size={16} />
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
                  fontSize={24}
                />
                <Box component="span" sx={TEXT_SX}>
                  <Box component="span" sx={NAME_SX}>
                    {label}
                  </Box>
                  {item.name === null ? null : (
                    <Box component="span" sx={ADDRESS_SX}>
                      {item.address}
                    </Box>
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
          onClick={onClearFilter}
          sx={CLEAR_FILTER_SX}
          data-testid={testIds.clearFilter}
        >
          {labels.clearFilter}
        </Button>
        <Button
          variant="contained"
          onClick={onDone}
          sx={DONE_SX}
          data-testid={testIds.done}
        >
          {labels.done}
        </Button>
      </Box>
    </Dialog>
  )
}
