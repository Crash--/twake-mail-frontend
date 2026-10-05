// Upstream to twake-ui: yes. twake-mui's `SearchBar` is a plain field: no
// suggestions, no combobox semantics, an English clear button and no slot
// after the input. Every Twake app with a search (Mail, Drive, Chat,
// Contacts) needs suggestions under its field; this is the ARIA 1.2
// combobox pattern around `SearchBar`, with a free header (filters) above
// the list.
import { Cross, Icon } from '@linagora/twake-icons'
import {
  Box,
  Divider,
  IconButton,
  Paper,
  Popper,
  type PopperProps,
  SearchBar,
  type SxProps,
  type Theme,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type SubmitEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref
} from 'react'

const POPUP_SX = { zIndex: 'modal' } as const
/** The field stays above the popup that starts behind it */
const FIELD_OPEN_Z_INDEX = 1301
/** Radius of the open panel, the field's own (a pill of 40 px) */
const PANEL_RADIUS = 20
type PopperModifier = NonNullable<PopperProps['modifiers']>[number]

/** The popup is as wide as the field, whatever the layout does after the focus */
const SAME_WIDTH: PopperModifier = {
  name: 'sameWidth',
  enabled: true,
  phase: 'beforeWrite',
  requires: ['computeStyles'],
  fn: ({ state }): void => {
    const popper = state.styles.popper
    if (popper !== undefined) popper.width = `${state.rects.reference.width}px`
  }
}
const SCROLL_SX = { maxHeight: '60vh', overflowY: 'auto' } as const
const LIST_SX = { listStyle: 'none', m: 0, p: 0 } as const
const OPTION_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  px: 2,
  py: 1,
  cursor: 'pointer',
  '&[aria-selected="true"]': { bgcolor: 'action.selected' },
  '&:hover': { bgcolor: 'action.hover' },
  // The highlighted words of a suggestion
  '& mark': { bgcolor: 'transparent', color: 'inherit', fontWeight: 700 }
} as const
const HEADING_SX = { px: 2, pt: 1, pb: 0.5, color: 'text.primary' } as const
const END_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  flexShrink: 0,
  color: 'text.secondary',
  typography: 'body2'
} as const

export interface SearchComboboxOption {
  id: string
  /** What the option shows, and its accessible name */
  label: ReactNode
  /** A second line (preview, address) */
  secondary?: ReactNode
  /** An icon or an avatar before the label */
  icon?: ReactNode
  /** At the end of the row: a date, a paper clip */
  end?: ReactNode
  'data-testid'?: string
}

export interface SearchComboboxGroup {
  id: string
  /** Visible heading naming the group, none for an untitled group */
  label: string | null
  /**
   * The group keeps its name for assistive technologies and shows a divider
   * above it in place of the heading
   */
  isLabelHidden?: boolean
  options: readonly SearchComboboxOption[]
}

/** What a parent can do to the field, e.g. on a keyboard shortcut */
export interface SearchComboboxActions {
  focus: () => void
  /** The field itself, to lay something over it */
  getField: () => HTMLElement | null
}

export interface SearchComboboxProps {
  value: string
  onChange: (value: string) => void
  /** Enter without an active option, or the search key of a phone */
  onSubmit: () => void
  /** An option chosen with Enter or a click */
  onSelect: (option: SearchComboboxOption) => void
  groups: readonly SearchComboboxGroup[]
  /** Above the options, e.g. quick filters (toggle buttons) */
  header?: ReactNode
  /** Accessible name of the field (its placeholder too) */
  label: string
  /** Accessible name of the list of suggestions */
  listLabel: string
  /** Name and tooltip of the button clearing the field */
  clearLabel: string
  /** Buttons after the field, e.g. "Advanced search" */
  endActions?: ReactNode
  /** Announced politely: the number of suggestions, a loading state */
  status?: string
  /** Called when the popup opens or closes */
  onOpenChange?: (isOpen: boolean) => void
  className?: string
  /** Receives `SearchComboboxActions`, as MUI's `action` props */
  actions?: Ref<SearchComboboxActions>
  testIds?: {
    input?: string
    clear?: string
    listbox?: string
  }
  'data-testid'?: string
}

/**
 * The field is flat and grey at rest; open, it is the head of the white
 * panel (which starts behind it) and leaves its background to the panel. The
 * focus ring only shows when the panel does not: the panel is the focus
 * indication then.
 */
function fieldSx(isOpen: boolean): SxProps<Theme> {
  return {
    position: 'relative',
    ...(isOpen
      ? {
          zIndex: FIELD_OPEN_Z_INDEX,
          '&&': { bgcolor: 'transparent' },
          '& .SearchBar-focusHighlight': { display: 'none' }
        }
      : {
          '&:has(input:focus-visible)': {
            outline: '2px solid',
            outlineColor: 'primary.main'
          }
        })
  }
}

/**
 * A search field with suggestions, as the ARIA 1.2 combobox pattern
 * describes it ("list autocomplete with manual selection"):
 *
 * - the field (`role="combobox"`) keeps the focus; ArrowDown / ArrowUp move
 *   the active option (`aria-activedescendant`), Enter picks it, or submits
 *   the text when none is active; Escape closes the suggestions, and only
 *   then lets the next Escape go to the page (e.g. to fold the search);
 * - options are grouped under visible headings (`role="group"`);
 * - the header (filters) follows the field in the tab order: the popup is
 *   rendered next to it, not in a portal; clicking it keeps the focus in
 *   the field;
 * - the popup opens with the focus and closes when it leaves the field and
 *   the popup; without options it only shows the header, the listbox is
 *   left out and the field stays collapsed (`aria-expanded="false"`);
 * - a right click on the field focuses it (tmail-flutter does), the
 *   browser menu still opens.
 */
export function SearchCombobox({
  value,
  onChange,
  onSubmit,
  onSelect,
  groups,
  header,
  label,
  listLabel,
  clearLabel,
  endActions,
  status,
  onOpenChange,
  className,
  actions,
  testIds = {},
  'data-testid': testId
}: SearchComboboxProps): ReactElement {
  const id = useId()
  const listboxId = `${id}-listbox`
  const anchorRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(
    actions,
    () => ({
      focus: () => {
        inputRef.current?.focus()
      },
      getField: () => anchorRef.current
    }),
    []
  )
  const [isOpen, setIsOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null)
  const fieldHeight = anchor?.offsetHeight ?? 0
  const options = useMemo(
    () => groups.flatMap(group => group.options),
    [groups]
  )
  const hasOptions = options.length > 0
  const hasContent = hasOptions || header !== undefined
  const isShown = isOpen && hasContent
  // Expanded means the listbox is shown: a popup holding only the header
  // (e.g. quick filters under an empty field) leaves it collapsed
  const isExpanded = isShown && hasOptions
  // New suggestions without the active one: none is active
  const activeIndex = options.findIndex(option => option.id === activeId)
  const active = isShown ? (options[activeIndex] ?? null) : null
  const optionId = (option: SearchComboboxOption): string =>
    `${id}-option-${option.id}`

  useEffect(() => {
    onOpenChange?.(isShown)
  }, [isShown, onOpenChange])

  useEffect(() => {
    if (active === null) return
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: 'nearest' })
    // optionId only depends on the stable id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const close = (): void => {
    setIsOpen(false)
    setActiveId(null)
  }

  const select = (option: SearchComboboxOption): void => {
    close()
    onSelect(option)
  }

  const move = (delta: number): void => {
    if (options.length === 0) return
    setIsOpen(true)
    const next =
      activeIndex === -1
        ? delta > 0
          ? 0
          : options.length - 1
        : (activeIndex + delta + options.length) % options.length
    setActiveId(options[next]?.id ?? null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Enter':
        if (active !== null) {
          event.preventDefault()
          select(active)
        }
        break
      case 'Escape':
        if (isShown) {
          event.preventDefault()
          event.stopPropagation()
          close()
        }
        break
      default:
        break
    }
  }

  const handleSubmit = (event: SubmitEvent<HTMLDivElement>): void => {
    event.preventDefault()
    close()
    onSubmit()
  }

  const handleChange = (event: { target: { value: string } }): void => {
    setIsOpen(true)
    onChange(event.target.value)
  }

  const handleClear = (): void => {
    onChange('')
    setIsOpen(true)
    inputRef.current?.focus()
  }

  const handleFocus = (): void => {
    setAnchor(anchorRef.current)
    setIsOpen(true)
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget
    if (next instanceof Node && rootRef.current?.contains(next)) return
    close()
  }

  const handleContextMenu = (): void => {
    inputRef.current?.focus()
  }

  // Clicks in the popup keep the focus in the field
  const keepFocus = (event: { preventDefault: () => void }): void => {
    event.preventDefault()
  }

  return (
    <Box
      ref={rootRef}
      className={className}
      onBlur={handleBlur}
      onContextMenu={handleContextMenu}
      data-testid={testId}
    >
      <SearchBar
        ref={anchorRef}
        size="small"
        elevation={0}
        disabledFocus
        sx={fieldSx(isShown)}
        className="u-w-100"
        placeholder={label}
        value={value}
        disabledClear
        onChange={handleChange}
        onFocus={handleFocus}
        onSubmit={handleSubmit}
        componentsProps={{
          inputBase: {
            inputRef,
            onKeyDown: handleKeyDown,
            endAdornment: (
              <Box className="u-flex u-flex-items-center u-flex-shrink-0">
                {value === '' ? null : (
                  <Tooltip title={clearLabel}>
                    <IconButton
                      size="small"
                      aria-label={clearLabel}
                      onClick={handleClear}
                      data-testid={testIds.clear}
                    >
                      <Icon icon={Cross} />
                    </IconButton>
                  </Tooltip>
                )}
                {endActions}
              </Box>
            ),
            inputProps: {
              role: 'combobox',
              'aria-expanded': isExpanded,
              // The listbox is only in the DOM while it is shown
              'aria-controls': isExpanded ? listboxId : undefined,
              'aria-autocomplete': 'list',
              'aria-activedescendant':
                active === null ? undefined : optionId(active),
              autoComplete: 'off',
              enterKeyHint: 'search',
              'data-testid': testIds.input
            }
          }
        }}
      />
      <Popper
        open={isShown}
        anchorEl={anchor}
        placement="bottom-start"
        disablePortal
        popperOptions={{ strategy: 'fixed' }}
        modifiers={[
          { name: 'offset', options: { offset: [0, -fieldHeight] } },
          SAME_WIDTH
        ]}
        sx={POPUP_SX}
      >
        <Paper
          elevation={8}
          sx={{ borderRadius: `${PANEL_RADIUS}px`, pt: `${fieldHeight}px` }}
          onMouseDown={keepFocus}
        >
          <Divider />
          <Box sx={SCROLL_SX}>
            {header}
            {hasOptions ? (
              <Box
                component="ul"
                id={listboxId}
                role="listbox"
                aria-label={listLabel}
                sx={LIST_SX}
                data-testid={testIds.listbox}
              >
                {groups.map(group =>
                  group.options.length === 0 ? null : (
                    <Box
                      component="li"
                      key={group.id}
                      role="presentation"
                      className="u-db"
                    >
                      {group.isLabelHidden === true ? (
                        <Divider component="div" aria-hidden="true" />
                      ) : null}
                      <Box
                        component="ul"
                        role="group"
                        aria-labelledby={
                          group.label === null ? undefined : `${id}-${group.id}`
                        }
                        sx={LIST_SX}
                      >
                        {group.label === null ? null : (
                          <Typography
                            component="li"
                            role="presentation"
                            id={`${id}-${group.id}`}
                            variant="body2"
                            className={
                              group.isLabelHidden === true
                                ? 'u-visuallyhidden'
                                : undefined
                            }
                            sx={HEADING_SX}
                          >
                            {group.label}
                          </Typography>
                        )}
                        {group.options.map(option => (
                          // Not focusable: the field keeps the focus and
                          // points at the active option, the keyboard acts
                          // from there (aria-activedescendant)
                          <Box
                            component="li"
                            key={option.id}
                            id={optionId(option)}
                            role="option"
                            aria-selected={active?.id === option.id}
                            sx={OPTION_SX}
                            onClick={() => {
                              select(option)
                            }}
                            data-testid={option['data-testid']}
                          >
                            {option.icon}
                            <Box className="u-flex-auto u-ov-hidden">
                              <Typography noWrap>{option.label}</Typography>
                              {option.secondary === undefined ? null : (
                                <Typography
                                  variant="body2"
                                  noWrap
                                  color="text.primary"
                                >
                                  {option.secondary}
                                </Typography>
                              )}
                            </Box>
                            {option.end === undefined ? null : (
                              <Box sx={END_SX} aria-hidden="true">
                                {option.end}
                              </Box>
                            )}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )
                )}
              </Box>
            ) : null}
          </Box>
        </Paper>
      </Popper>
      {/* Always mounted: a live region only announces changes */}
      <Box role="status" className="u-visuallyhidden">
        {isShown ? status : null}
      </Box>
    </Box>
  )
}
