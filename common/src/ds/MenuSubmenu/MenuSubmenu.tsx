// Upstream to twake-ui: yes. tmail-flutter opens some entries of its menus
// as a submenu on hover (`PopupSubmenuController`: "Label as"): a 249 px
// white panel, elevation 8, rounded by 6 px, at most 400 px high, beside the
// entry, which shows a small triangle while it is open. twake-mui's `Menu`
// has no submenu.
//
// Accessibility: the entry is a `menuitem` with `aria-haspopup="menu"` and
// `aria-expanded`; ArrowRight, Enter or Space open the submenu on its first
// entry, ArrowLeft or Escape close it and give the focus back to the entry.
// The pointer opens it on hover, and it closes once the pointer leaves both.
// The menu holding it must let the focus go (`disableEnforceFocus`): the
// submenu is drawn over it, outside it.
import {
  Box,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Paper,
  Popper
} from '@linagora/twake-mui'
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode
} from 'react'

import { TMAIL } from '@/ds/TmailColors/tmailColors'

/** Leaving the entry for the panel crosses a gap: closing waits a little */
const CLOSE_DELAY_MS = 150

const PAPER_SX = {
  width: 249,
  maxHeight: 400,
  overflowY: 'auto',
  borderRadius: '6px'
} as const

const LIST_SX = { py: 0 } as const

const CARET_SX = { display: 'flex', color: TMAIL.steel, ml: '16px' } as const

/** `ic_thumbs_up` of tmail-flutter: a small triangle pointing to the panel */
function Caret(): ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7.91663 14.1668L12.0833 10.0002L7.91663 5.8335L7.91663 14.1668Z"
        fill="currentColor"
      />
    </svg>
  )
}

export interface MenuSubmenuItemProps {
  label: string
  /** Before the label, as the other entries of the menu */
  icon?: ReactNode
  /** Name of the submenu */
  menuLabel: string
  /** Its entries (`MenuItem`s, `Divider`s); a click on one closes it */
  children: ReactNode
  'data-testid'?: string
  submenuTestId?: string
}

/** An entry of a menu opening a submenu beside it */
export function MenuSubmenuItem({
  label,
  icon,
  menuLabel,
  children,
  'data-testid': testId,
  submenuTestId
}: MenuSubmenuItemProps): ReactElement {
  const itemRef = useRef<HTMLLIElement | null>(null)
  const [anchor, setAnchor] = useState<HTMLLIElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isByKeyboard, setIsByKeyboard] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = (): void => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }
  const scheduleClose = (): void => {
    cancelClose()
    timer.current = setTimeout(() => {
      setIsOpen(false)
    }, CLOSE_DELAY_MS)
  }
  useEffect(() => cancelClose, [])

  const close = (): void => {
    cancelClose()
    setIsOpen(false)
  }

  const openByKeyboard = (): void => {
    cancelClose()
    setIsByKeyboard(true)
    setIsOpen(true)
  }

  const handleItemKeyDown = (event: KeyboardEvent<HTMLLIElement>): void => {
    if (event.target !== itemRef.current) return
    if (
      event.key === 'ArrowRight' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault()
      event.stopPropagation()
      openByKeyboard()
    }
  }

  const handleSubmenuKeyDown = (
    event: KeyboardEvent<HTMLUListElement>
  ): void => {
    // Its own keys: the menu around it must not move nor close
    event.stopPropagation()
    if (event.key === 'ArrowLeft' || event.key === 'Escape') {
      event.preventDefault()
      close()
      itemRef.current?.focus()
    }
  }

  return (
    <MenuItem
      ref={(node: HTMLLIElement | null) => {
        itemRef.current = node
        setAnchor(node)
      }}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      onMouseEnter={() => {
        cancelClose()
        setIsByKeyboard(false)
        setIsOpen(true)
      }}
      onMouseLeave={scheduleClose}
      onClick={() => {
        if (!isOpen) openByKeyboard()
      }}
      onKeyDown={handleItemKeyDown}
      data-testid={testId}
    >
      {icon === undefined ? null : <ListItemIcon>{icon}</ListItemIcon>}
      <ListItemText primary={label} />
      {isOpen ? (
        <Box component="span" sx={CARET_SX}>
          <Caret />
        </Box>
      ) : null}
      <Popper
        open={isOpen}
        anchorEl={anchor}
        placement="right-start"
        // Over the menu, not clipped by it: the menu lets the focus go
        // (`disableEnforceFocus`), the keys still go through this entry
        modifiers={[
          { name: 'flip', options: { fallbackPlacements: ['left-start'] } }
        ]}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        onClick={event => {
          // An entry chosen: the submenu goes, not reopened by the entry
          event.stopPropagation()
          close()
        }}
        sx={{ zIndex: theme => theme.zIndex.modal + 1 }}
      >
        <Paper elevation={8} sx={PAPER_SX}>
          <MenuList
            autoFocusItem={isOpen && isByKeyboard}
            aria-label={menuLabel}
            onKeyDown={handleSubmenuKeyDown}
            sx={LIST_SX}
            data-testid={submenuTestId}
          >
            {children}
          </MenuList>
        </Paper>
      </Popper>
    </MenuItem>
  )
}
