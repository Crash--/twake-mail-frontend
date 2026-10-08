// Upstream to twake-ui: no, the look of tmail-flutter's AI assistant menu
// (`AiScribeContextMenu`, `AIScribeSizes`): a white 191 px card, a 6 px
// radius and a soft shadow, 40 px rows (a 20 px grey icon, 12 px, the name
// in Regular 14 grey, a chevron for a category holding several actions),
// whose actions open in a second card 6 px to the right while the category
// is hovered or opened from the keyboard.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Box, ButtonBase } from '@linagora/twake-mui'
import {
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type RefObject
} from 'react'

import { Right } from '@/ds/FlutterIcons/FlutterIcons'

const MENU_WIDTH = 191
const MENU_MAX_HEIGHT = 352
const ROW_HEIGHT = 40
const SUBMENU_GAP = 6
const SHADOW =
  '0 0 0 0.5px rgba(66, 66, 68, 0.12), 0 6px 26px 2px rgba(66, 66, 68, 0.11)'

const CARD_SX = {
  width: MENU_WIDTH,
  maxHeight: MENU_MAX_HEIGHT,
  py: 1,
  boxSizing: 'border-box',
  bgcolor: '#FFFFFF',
  borderRadius: '6px',
  boxShadow: SHADOW
} as const

function rowSx(inset: number): Record<string, unknown> {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    height: ROW_HEIGHT,
    pl: `${inset}px`,
    pr: '10px',
    gap: '12px',
    textAlign: 'start',
    fontSize: 14,
    lineHeight: '21px',
    letterSpacing: '-0.15px',
    fontWeight: 400,
    color: 'rgba(66, 66, 68, 0.9)',
    '&:hover, &[aria-expanded="true"]': { bgcolor: '#F3F6F9' },
    '& .AiScribeMenu-icon': {
      display: 'flex',
      color: 'rgba(66, 66, 68, 0.72)'
    },
    '& .AiScribeMenu-chevron': {
      display: 'flex',
      ml: 'auto',
      color: '#777778'
    }
  }
}

const NAME_SX = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

export interface AiScribeMenuAction {
  id: string
  label: string
  icon?: IconProps['icon'] | null
}

export interface AiScribeMenuCategory {
  id: string
  label: string
  icon: IconProps['icon']
  /** One action runs on a click; several open in a second card */
  actions: readonly AiScribeMenuAction[]
}

export interface AiScribeMenuProps {
  /** Accessible name of the menu */
  label: string
  categories: readonly AiScribeMenuCategory[]
  /** An action was chosen (its id) */
  onSelect: (actionId: string) => void
  'data-testid'?: string
}

function focusItem(container: HTMLElement | null, index: number): void {
  const items = container?.querySelectorAll<HTMLElement>(
    ':scope > * > [role="menuitem"], :scope > [role="menuitem"]'
  )
  if (!items || items.length === 0) return
  const count = items.length
  items[((index % count) + count) % count]?.focus()
}

function indexOf(container: HTMLElement | null, item: Element): number {
  const items = Array.from(
    container?.querySelectorAll(
      ':scope > * > [role="menuitem"], :scope > [role="menuitem"]'
    ) ?? []
  )
  return items.indexOf(item)
}

/** Up, Down, Home and End move between the items of a menu */
function moveFocus(
  event: KeyboardEvent<HTMLElement>,
  container: RefObject<HTMLElement | null>
): boolean {
  const current = indexOf(container.current, event.target as Element)
  const moves: Record<string, number | 'first' | 'last'> = {
    ArrowDown: current + 1,
    ArrowUp: current - 1,
    Home: 'first',
    End: 'last'
  }
  const move = moves[event.key]
  if (move === undefined) return false
  event.preventDefault()
  const count =
    container.current?.querySelectorAll(
      ':scope > * > [role="menuitem"], :scope > [role="menuitem"]'
    ).length ?? 0
  focusItem(
    container.current,
    move === 'first' ? 0 : move === 'last' ? count - 1 : move
  )
  return true
}

/**
 * The menu of the AI assistant, as the ARIA menu pattern: one stop in the
 * tab order, Up and Down between the categories, Right, Enter or Space open
 * the actions of a category (its only action runs), Left and Escape close
 * them back to it. The pointer opens a category by hovering it.
 */
export function AiScribeMenu({
  label,
  categories,
  onSelect,
  'data-testid': testId
}: AiScribeMenuProps): ReactElement {
  const menuRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(
    categories[0]?.id ?? null
  )

  const openSubmenu = (category: AiScribeMenuCategory): void => {
    setOpenId(category.id)
    // The card is there on the next paint
    window.requestAnimationFrame(() => {
      focusItem(submenuRef.current, 0)
    })
  }

  const choose = (category: AiScribeMenuCategory): void => {
    const [first, ...others] = category.actions
    if (others.length > 0) {
      openSubmenu(category)
      return
    }
    if (first !== undefined) onSelect(first.id)
  }

  const handleMenuKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    category: AiScribeMenuCategory
  ): void => {
    if (moveFocus(event, menuRef)) return
    // Enter and Space click the button
    if (event.key === 'ArrowRight' && category.actions.length > 1) {
      event.preventDefault()
      openSubmenu(category)
    }
  }

  const handleSubmenuKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    category: AiScribeMenuCategory
  ): void => {
    if (moveFocus(event, submenuRef)) return
    if (event.key === 'ArrowLeft' || event.key === 'Escape') {
      // Back to the category, the cards stay open
      event.preventDefault()
      event.stopPropagation()
      setOpenId(null)
      const index = categories.findIndex(item => item.id === category.id)
      focusItem(menuRef.current, index)
    }
  }

  return (
    <Box
      ref={menuRef}
      role="menu"
      aria-label={label}
      sx={{ ...CARD_SX, position: 'relative' }}
      data-testid={testId}
    >
      {categories.map(category => {
        const hasSubmenu = category.actions.length > 1
        const isOpen = hasSubmenu && openId === category.id
        return (
          <Box key={category.id} sx={{ position: 'relative' }}>
            <ButtonBase
              role="menuitem"
              aria-haspopup={hasSubmenu ? 'menu' : undefined}
              aria-expanded={hasSubmenu ? isOpen : undefined}
              tabIndex={focusId === category.id ? 0 : -1}
              onFocus={() => {
                setFocusId(category.id)
              }}
              onMouseEnter={() => {
                setOpenId(hasSubmenu ? category.id : null)
              }}
              onClick={() => {
                choose(category)
              }}
              onKeyDown={event => {
                handleMenuKeyDown(event, category)
              }}
              sx={rowSx(14)}
              data-testid="ai-scribe-category"
              data-category={category.id}
            >
              <span className="AiScribeMenu-icon">
                <Icon icon={category.icon} size={20} aria-hidden="true" />
              </span>
              <Box component="span" sx={NAME_SX}>
                {category.label}
              </Box>
              {hasSubmenu ? (
                <span className="AiScribeMenu-chevron">
                  <Icon icon={Right} size={16} aria-hidden="true" />
                </span>
              ) : null}
            </ButtonBase>
            {isOpen ? (
              <Box
                ref={submenuRef}
                role="menu"
                aria-label={category.label}
                sx={{
                  ...CARD_SX,
                  py: 0,
                  overflow: 'hidden',
                  position: 'absolute',
                  top: 0,
                  left: `calc(100% + ${SUBMENU_GAP}px)`,
                  zIndex: 1
                }}
                data-testid="ai-scribe-submenu"
              >
                {category.actions.map(action => (
                  <ButtonBase
                    key={action.id}
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => {
                      onSelect(action.id)
                    }}
                    onKeyDown={event => {
                      handleSubmenuKeyDown(event, category)
                    }}
                    sx={rowSx(16)}
                    data-testid="ai-scribe-action"
                    data-action={action.id}
                  >
                    {action.icon ? (
                      <span className="AiScribeMenu-icon">
                        <Icon icon={action.icon} size={20} aria-hidden="true" />
                      </span>
                    ) : null}
                    <Box component="span" sx={NAME_SX}>
                      {action.label}
                    </Box>
                  </ButtonBase>
                ))}
              </Box>
            ) : null}
          </Box>
        )
      })}
    </Box>
  )
}
