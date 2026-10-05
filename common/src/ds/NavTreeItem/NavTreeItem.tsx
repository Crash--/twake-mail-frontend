// Upstream to twake-ui: yes, as the nested, collapsible `NavItem` that
// docs/twake-mui-gaps.md ("Mailbox tree") asks for. twake-mui's `NavItem`
// is one flat, 36 px row whose link carries the whole background; this one
// puts the background on the row, indents by level without a cap, puts the
// expand arrow after the label as a control of its own, and overlays the
// actions on hover instead of reserving room for them.
import { Bottom, Icon, Right } from '@linagora/twake-icons'
import { Box, IconButton, NavItem, NavLink, Tooltip } from '@linagora/twake-mui'
import {
  useRef,
  useState,
  type ElementType,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode
} from 'react'

import { DropTarget } from '@/ds/DropTarget/DropTarget'
import { NAV_ACCENT } from '@/ds/navColors/navColors'
import { TOUCH_MEDIA, TOUCH_TARGET_SIZE } from '@/ds/TouchTargets/TouchTargets'

/** Start padding of the first level (the 8 px of the row) */
const BASE_INDENT = 8
/** Padding of the second level: 8 + icon 16 + gap 12 + 8 (Figma) */
const SECOND_LEVEL_INDENT = 44
/** What each level below the second adds */
const LEVEL_STEP = 8

/** Start padding of the link of a row of the given level (1 = top), no cap */
export function levelIndent(level: number): number {
  if (level <= 1) return BASE_INDENT
  return SECOND_LEVEL_INDENT + (level - 2) * LEVEL_STEP
}

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
  /** The icon, 16 px: an `Icon`; it takes the colour of the row */
  icon: ReactNode
  label: string
  /** The link component (e.g. the router `Link`) and where it goes */
  linkComponent: ElementType
  to: string
  isSelected?: boolean
  /** The arrow after the label, for a row with children */
  toggle?: NavTreeItemToggle
  /** A `CountBadge`, at the end of the row */
  count?: ReactNode
  /** Said after the name by screen readers, e.g. the unread count */
  countText?: string
  /** Short text after the name (e.g. "Hidden") */
  meta?: ReactNode
  /**
   * Icon buttons overlaid on the end of the row while it is hovered or holds
   * the keyboard focus (always there on touch screens); they take no room
   * otherwise
   */
  actions?: ReactNode
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

const ROW_BACKGROUND =
  (selected: boolean) =>
  (theme: { palette: { action: { selected: string; hover: string } } }) =>
    selected ? theme.palette.action.selected : theme.palette.action.hover

/**
 * A row of a navigation tree: icon, name, then the arrow of a folder with
 * children, the counter and the actions. The whole row (36 px at least,
 * radius 8) is the link and carries the hover and selected backgrounds; the
 * arrow and the actions are controls of their own above it, so a tree
 * keyboard user tabs to them. A name cut by the width shows in a tooltip.
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
  actions,
  drop,
  itemProps,
  'data-testid': testId,
  nameTestId
}: NavTreeItemProps): ReactElement {
  const nameRef = useRef<HTMLSpanElement>(null)
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)
  const hasActions = actions !== undefined && actions !== null
  const rowBackground = ROW_BACKGROUND(isSelected)

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
        enterDelay={500}
      >
        <NavLink
          component={linkComponent}
          to={to}
          selected={isSelected}
          // Tooltip would name the link by the title: the content does it
          aria-label={undefined}
          sx={{
            flex: '0 1 auto',
            minWidth: 0,
            m: 0,
            minHeight: 36,
            height: 'auto',
            py: '5px',
            pl: `${levelIndent(level)}px`,
            pr: 0,
            '&, &:hover, &.Mui-selected, &.Mui-selected:hover, &.Mui-focusVisible':
              { backgroundColor: 'transparent' },
            '&.Mui-selected, &.Mui-selected .MuiListItemIcon-root': {
              color: NAV_ACCENT
            },
            // The link covers the whole row; the arrow and actions sit above
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: '8px'
            },
            '&.Mui-focusVisible::after': {
              outline: `2px solid ${NAV_ACCENT}`,
              outlineOffset: '-2px'
            }
          }}
        >
          <Box
            component="span"
            aria-hidden="true"
            className="u-flex u-flex-items-center u-flex-shrink-0"
            sx={{ mr: '12px' }}
          >
            {icon}
          </Box>
          <Box
            component="span"
            ref={nameRef}
            className="u-ellipsis"
            data-testid={nameTestId}
            sx={{
              minWidth: 0,
              fontSize: 14,
              fontWeight: 500,
              lineHeight: '18.4px',
              letterSpacing: 0.25
            }}
          >
            {label}
          </Box>
          {meta}
          {countText === undefined ? null : (
            <span className="u-visuallyhidden"> {countText}</span>
          )}
        </NavLink>
      </Tooltip>
      {toggle ? (
        <Tooltip title={toggle.label}>
          <IconButton
            aria-label={toggle.label}
            onClick={event => {
              event.stopPropagation()
              toggle.onToggle()
            }}
            data-testid={toggle['data-testid']}
            sx={{
              position: 'relative',
              zIndex: 1,
              flex: 'none',
              boxSizing: 'border-box',
              width: 24,
              height: 24,
              minWidth: 0,
              minHeight: 0,
              p: '4px',
              ml: '4px',
              // A 44 px target on touch screens, without moving the arrow
              [TOUCH_MEDIA]: {
                width: TOUCH_TARGET_SIZE,
                height: TOUCH_TARGET_SIZE,
                p: '14px',
                m: '0 -14px 0 -10px'
              }
            }}
          >
            <Icon icon={toggle.isExpanded ? Bottom : Right} size={16} />
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
        // Positioned and styled by the row (see `sx` of the `NavItem`)
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
    <NavItem
      {...itemProps}
      data-testid={testId}
      sx={theme => ({
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        height: 'auto',
        minHeight: 36,
        mx: 2,
        width: 'auto',
        pr: '8px',
        borderRadius: '8px',
        backgroundColor: isSelected ? theme.palette.action.selected : undefined,
        '&:hover': { backgroundColor: rowBackground(theme) },
        ...(hasActions
          ? {
              '& [data-nav-actions]': { ml: 'auto' },
              '& [data-nav-count] ~ [data-nav-actions]': { ml: 0.5 },
              // Without a pointer to hover, the actions are always there. With
              // one, they take no room until the row is hovered or holds the
              // keyboard focus, then replace the counter (they stay focusable)
              '@media (hover: hover)': {
                '& [data-nav-actions]': {
                  width: 0,
                  overflow: 'hidden',
                  opacity: 0
                },
                '&:hover [data-nav-actions], &:has(:focus-visible) [data-nav-actions]':
                  { width: 'auto', overflow: 'visible', opacity: 1 },
                '&:hover [data-nav-count], &:has(:focus-visible) [data-nav-count]':
                  { display: 'none' }
              }
            }
          : {}),
        [TOUCH_MEDIA]: { minHeight: TOUCH_TARGET_SIZE }
      })}
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
    </NavItem>
  )
}
