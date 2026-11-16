// Upstream to twake-ui: yes, as the nested, collapsible `NavItem` that
// docs/twake-mui-gaps.md ("Mailbox tree") asks for. twake-mui's `NavItem`
// is one flat, 36 px row whose link carries the whole background; this one
// puts the background on the row, indents by level without a cap, puts the
// expand arrow after the label as a control of its own, and overlays the
// actions on hover instead of reserving room for them.
import { Icon, Dropdown, Right } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip } from '@linagora/twake-mui'
import { ListItem } from '@mui/material'
import { NavLink } from '@/ds/NavLink/NavLink'
import {
  createContext,
  use,
  useId,
  useRef,
  useState,
  type ElementType,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode
} from 'react'

import { DropTarget } from '@/ds/DropTarget/DropTarget'
import {
  FOCUS_RING,
  FOCUS_RING_INSET
} from '@/ds/FocusIndicator/focusIndicator'
import { useLongPress } from '@/ds/useLongPress/useLongPress'

/** What each level below the first moves the whole row (the design) */
const LEVEL_STEP = 16
/** Start padding of the row, before its icon */
const ROW_PADDING = 8
/** The icon, and the gap after it */
const ICON_SIZE = 16
const ICON_GAP = 12
/** Height of the name line and of the second line, and the gap between */
const NAME_LINE = 18.4
const SECONDARY_LINE = 16
const SECONDARY_GAP = 2
/**
 * The small `IconButton` of twake-mui around the 12 px arrow (8 px padding),
 * which sets the height of the name line it is on
 */
const TOGGLE_SIZE = 28
/** The row of the design, on every screen (touch included) */
const ROW_HEIGHT = 36

/**
 * How far the content of a row of the given level (1 = top) moves in, as the
 * sidebar item of the design: 16 px a level, no cap. The background of the
 * row keeps the whole width.
 */
export function levelIndent(level: number): number {
  return Math.max(0, level - 1) * LEVEL_STEP
}

/** Levels the rows under it are nested in besides their own (`NavCategory`) */
export const NavTreeDepth = createContext(0)

type DataAttributes = Record<`data-${string}`, string | boolean | undefined>

export interface NavTreeItemToggle {
  /** Name and tooltip of the arrow: "Expand" / "Collapse" */
  label: string
  isExpanded: boolean
  onToggle: () => void
  'data-testid'?: string
}

export interface NavTreeItemProps {
  /** Level of the row, 1 for the top ones: sets the indentation */
  level: number
  /** The icon, 16 px: an `Icon`; it takes the colour of the row; or none */
  icon: ReactNode | null
  label: string
  /**
   * The link component (e.g. the router `Link`) and where it goes. Without
   * them the row is no link, only a container: a click on it presses its
   * arrow, as Enter does
   */
  linkComponent?: ElementType
  to?: string
  isSelected?: boolean
  /** The arrow after the label, for a row with children */
  toggle?: NavTreeItemToggle
  /** A `CountBadge`, at the end of the row */
  count?: ReactNode
  /** Said after the name by screen readers, e.g. the unread count */
  countText?: string
  /**
   * Short text after the name (e.g. "Hidden", an address), on one line: the
   * row cuts it before the name when it lacks room
   */
  meta?: ReactNode
  /** A second line under the name (e.g. the path of a search result) */
  secondary?: ReactNode
  /**
   * Icon buttons overlaid on the end of the row while it is hovered or holds
   * the keyboard focus (always there on touch screens); they take no room
   * otherwise
   */
  actions?: ReactNode
  /**
   * A finger held on the row: opens its menu, anchored to the row, without
   * following the link
   */
  onLongPress?: (row: HTMLElement) => void
  /**
   * With `onLongPress`, what a screen reader says of it (e.g. "Long press
   * for actions"), on what holds the focus, which then has a menu popup.
   * VoiceOver and TalkBack turn a double tap held into a long press.
   */
  longPressHint?: string
  /** Makes the row a drop target */
  drop?: {
    accepts: (types: readonly string[]) => boolean
    onDrop: (dataTransfer: DataTransfer) => void
  }
  /** The `li`: `role`, `aria-*`, `data-*` and handlers */
  itemProps?: HTMLAttributes<HTMLLIElement> & DataAttributes
  'data-testid'?: string
  nameTestId?: string
}

/**
 * A row of a navigation tree: icon, name, then the arrow of a folder with
 * children, the counter and the actions. The whole row (36 px at least,
 * radius 8) is the link and carries the hover and selected backgrounds; the
 * arrow and the actions are controls of their own above it. As a
 * `role="treeitem"` of a `NavTree` the row itself holds the keyboard focus
 * (its name is the one of the link), the arrow keys of the tree drive the
 * arrow, and Tab reaches the buttons of the focused row. A name cut by the
 * width shows in a tooltip. A row without `to` is a container (e.g. the
 * root of a team mailbox): no link, a click opens or closes it.
 */
export function NavTreeItem({
  level,
  icon,
  label,
  linkComponent,
  to,
  isSelected = false,
  toggle,
  count,
  countText,
  meta,
  secondary,
  actions,
  onLongPress,
  longPressHint,
  drop,
  itemProps,
  'data-testid': testId,
  nameTestId
}: NavTreeItemProps): ReactElement {
  const longPress = useLongPress(onLongPress)
  const indent = levelIndent(level + use(NavTreeDepth))
  const nameRef = useRef<HTMLSpanElement>(null)
  const linkId = useId()
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const hasActions = actions !== undefined && actions !== null
  const hasSecondary = secondary !== undefined && secondary !== null
  // Over a second line, the name line is as high as the arrow on it
  const firstLine = toggle ? TOGGLE_SIZE : NAME_LINE
  const isLink = linkComponent !== undefined && to !== undefined
  const isTreeItem = itemProps?.role === 'treeitem'
  const menuHint =
    onLongPress !== undefined && longPressHint !== undefined
      ? { 'aria-haspopup': 'menu' as const, 'aria-description': longPressHint }
      : {}

  const handleTooltipOpen = (): void => {
    const name = nameRef.current
    setIsTruncated(name !== null && name.scrollWidth > name.clientWidth)
    setIsTooltipOpen(true)
  }
  const handleTooltipClose = (): void => {
    setIsTooltipOpen(false)
  }

  const content = (
    <>
      <Tooltip
        title={label}
        open={isTooltipOpen && isTruncated}
        onOpen={handleTooltipOpen}
        onClose={handleTooltipClose}
        placement="right"
        disableInteractive
        enterDelay={500}
      >
        <NavLink
          id={linkId}
          {...(isLink
            ? { component: linkComponent, to, ...(isTreeItem ? {} : menuHint) }
            : {
                // Not a control of its own: the row holds the focus, its
                // arrow is the control
                component: 'span',
                role: undefined,
                tabIndex: -1,
                onClick: toggle?.onToggle
              })}
          selected={isSelected}
          // Tooltip would name the link by the title: the content does it
          aria-label={undefined}
          sx={{
            // Not positioned (ButtonBase is): the ::after below is the row's
            position: 'static',
            flex: '0 1 auto',
            minWidth: 0,
            m: 0,
            minHeight: ROW_HEIGHT,
            height: 'auto',
            // A second line hangs under the name, as tmail-flutter, without
            // pushing the arrow after it: the arrow follows the name
            // A pixel lower than centred: where tmail-flutter's text
            // lands on its line
            pt: hasSecondary ? `${(firstLine - NAME_LINE) / 2 + 1}px` : '5px',
            pb: hasSecondary
              ? `${(firstLine - NAME_LINE) / 2 - 1 + SECONDARY_GAP + SECONDARY_LINE}px`
              : '5px',
            alignSelf: hasSecondary ? 'flex-start' : undefined,
            pl: `${ROW_PADDING}px`,
            pr: 0,
            '&, &:hover, &.Mui-selected, &.Mui-selected:hover, &.Mui-focusVisible':
              { backgroundColor: 'transparent' },
            '&.Mui-selected, &.Mui-selected .MuiListItemIcon-root': {
              color: 'primary.main'
            },
            // The link covers the whole row; the arrow and actions sit above
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: '8px'
            },
            '&.Mui-focusVisible': { outline: 'none' },
            '&.Mui-focusVisible::after': { ...FOCUS_RING, ...FOCUS_RING_INSET }
          }}
        >
          {icon === null ? null : (
            <Box
              component="span"
              aria-hidden="true"
              className="u-flex u-flex-items-center u-flex-shrink-0"
              sx={{ mr: `${ICON_GAP}px` }}
            >
              {icon}
            </Box>
          )}
          <Box
            component="span"
            className="u-flex u-flex-column"
            sx={{ minWidth: 0 }}
          >
            <Box
              component="span"
              ref={nameRef}
              className="u-ellipsis"
              data-testid={nameTestId}
              sx={{
                minWidth: 0,
                typography: 'body2',
                lineHeight: `${NAME_LINE}px`
              }}
            >
              {label}
            </Box>
            {hasSecondary ? (
              // On the row, under the name, as wide as the row: out of the
              // width of the name, which the arrow follows
              <Box
                component="span"
                className="u-ellipsis"
                sx={{
                  position: 'absolute',
                  insetInlineStart: `${indent + ROW_PADDING + (icon === null ? 0 : ICON_SIZE + ICON_GAP)}px`,
                  insetInlineEnd: '8px',
                  top: `${firstLine + SECONDARY_GAP}px`,
                  color: 'inherit',
                  typography: 'caption',
                  lineHeight: `${SECONDARY_LINE}px`
                }}
              >
                {secondary}
              </Box>
            ) : null}
          </Box>
          {meta === undefined || meta === null ? null : (
            // Gives way before the name: cut first, down to nothing
            <Box
              component="span"
              data-nav-meta=""
              className="u-flex u-flex-items-center"
              sx={{ minWidth: 0, flex: '0 1000 auto' }}
            >
              {meta}
            </Box>
          )}
          {countText === undefined ? null : (
            <span className="u-visuallyhidden"> {countText}</span>
          )}
        </NavLink>
      </Tooltip>
      {toggle ? (
        // Not interactive: it would cover the row below the arrow
        <Tooltip title={toggle.label} disableInteractive>
          <IconButton
            aria-label={toggle.label}
            onClick={event => {
              event.stopPropagation()
              toggle.onToggle()
            }}
            data-testid={toggle['data-testid']}
            // What the Right and Left keys of a tree press
            data-nav-toggle=""
            size="small"
            sx={{
              position: 'relative',
              zIndex: 1,
              flex: 'none',
              // Out of the 44 px minimum of `TouchTargets`: the row stays
              // 36 px on touch screens, as the design
              minWidth: 0,
              minHeight: 0,
              ml: '4px',
              // On the name line, when a second line hangs under it
              alignSelf: hasSecondary ? 'flex-start' : undefined
            }}
          >
            <Icon icon={toggle.isExpanded ? Dropdown : Right} size={12} />
          </IconButton>
        </Tooltip>
      ) : null}
      {count === undefined || count === null ? null : (
        <Box
          component="span"
          data-nav-count=""
          className="u-flex u-flex-items-center u-flex-shrink-0"
          sx={{ ml: 'auto', pl: 1 }}
        >
          {count}
        </Box>
      )}
      {hasActions ? (
        // Positioned and styled by the row (see `sx` of the row)
        <Box
          component="span"
          data-nav-actions=""
          className="u-flex u-flex-items-center"
        >
          {actions}
        </Box>
      ) : null}
    </>
  )

  return (
    <ListItem
      disablePadding
      // A row of a tree holds the focus: the buttons inside must not name it
      aria-labelledby={isTreeItem ? linkId : undefined}
      {...(isTreeItem ? menuHint : {})}
      {...itemProps}
      {...longPress.handlers}
      onContextMenu={event => {
        // A long press the browser reports as a context menu (Android):
        // once only, when the timer did not open the menu already
        if (longPress.cancel()) {
          event.preventDefault()
          return
        }
        itemProps?.onContextMenu?.(event)
      }}
      onFocus={event => {
        itemProps?.onFocus?.(event)
        // A row of a tree holds the keyboard focus: a name cut by the width
        // shows then as it does on hover (not for a click)
        if (
          event.target === event.currentTarget &&
          event.currentTarget.matches(':focus-visible')
        ) {
          handleTooltipOpen()
        }
      }}
      onBlur={event => {
        itemProps?.onBlur?.(event)
        if (event.target === event.currentTarget) handleTooltipClose()
      }}
      data-testid={testId}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        height: 'auto',
        minHeight: hasSecondary
          ? `${firstLine + SECONDARY_GAP + SECONDARY_LINE}px`
          : ROW_HEIGHT,
        mr: 2,
        ml: '16px',
        pl: `${indent}px`,
        width: 'auto',
        pr: '8px',
        borderRadius: '8px',
        backgroundColor: isSelected ? 'action.selected' : undefined,
        '&:hover': {
          backgroundColor: isSelected ? 'action.selected' : 'action.hover'
        },
        ...(hasActions
          ? {
              '& [data-nav-actions]': { ml: 'auto' },
              '& [data-nav-count] ~ [data-nav-actions]': { ml: 1 },
              // Out of the 44 px minimum of `TouchTargets`, as the arrow
              '& [data-nav-actions] .MuiIconButton-root': {
                minWidth: 0,
                minHeight: 0
              },
              '& [data-nav-actions] .MuiButton-root': { minHeight: 0 },
              // Without a pointer to hover, the actions are always there. With
              // one, they take no room until the row is hovered or holds the
              // keyboard focus, then replace the counter (they stay focusable)
              '@media (hover: hover)': {
                '& [data-nav-actions]': {
                  width: 0,
                  overflow: 'hidden',
                  opacity: 0
                },
                // At the end of the row, in place of the hidden counter
                '& [data-nav-count] ~ [data-nav-actions]': { ml: 0 },
                '&:hover [data-nav-actions], &:has(:focus-visible) [data-nav-actions]':
                  {
                    width: 'auto',
                    overflow: 'visible',
                    opacity: 1,
                    ml: 'auto'
                  },
                '&:hover [data-nav-count], &:has(:focus-visible) [data-nav-count]':
                  { display: 'none' }
              }
            }
          : {}),
        // No callout nor text selection under a finger held for the menu
        ...(onLongPress
          ? { WebkitTouchCallout: 'none', userSelect: 'none' }
          : {})
      }}
    >
      {drop ? (
        <DropTarget
          accepts={drop.accepts}
          onDrop={drop.onDrop}
          className="u-flex u-flex-items-center u-flex-auto u-h-100 u-ov-hidden"
        >
          {content}
        </DropTarget>
      ) : (
        <div className="u-flex u-flex-items-center u-flex-auto u-h-100 u-ov-hidden">
          {content}
        </div>
      )}
    </ListItem>
  )
}
