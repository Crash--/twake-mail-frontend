// Upstream to twake-ui: yes. A destination picker in twake-mui's `FixedDialog`:
// a `SearchBar`, then the folders by blocks (the system ones, "Personal
// folders", "Team-mailboxes", the last two folding), 36 px rows with a 16 px
// icon and the subfolders folded behind a chevron after the name. twake-mui
// has no such tree.
//
// Accessibility: the search field is a combobox (ARIA 1.2) driving one
// listbox per block; ArrowDown / ArrowUp move the active folder, ArrowRight
// and ArrowLeft unfold and fold its subfolders, Enter picks it; a disabled
// folder with subfolders is reached too (`aria-disabled`, Enter ignored) to
// unfold it; the headers of the blocks are buttons (`aria-expanded`). An
// optional "New folder" icon button, with its tooltip, follows the search.
import {
  Icon,
  type IconProps,
  Bottom,
  Check,
  Right,
  Plus
} from '@linagora/twake-icons'
import {
  Box,
  ButtonBase,
  Divider,
  FixedDialog,
  IconButton,
  SearchBar,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement
} from 'react'

import { useScreenSize } from '@/ds/useScreenSize/useScreenSize'

export interface FolderPickerOption {
  id: string
  label: string
  /** Under the label while searching, e.g. the path of the folder */
  secondary?: string | null
  /** Always under the label, e.g. the address of a team mailbox */
  subtitle?: string | null
  /** From 1 */
  level: number
  /** The option holding it, when it is a subfolder */
  parentId: string | null
  hasChildren: boolean
  icon?: IconProps['icon'] | null
  /** Listed faded, not selectable */
  disabled?: boolean
  /** The folder concerned: bold with a check, not selectable */
  isCurrent?: boolean
}

export interface FolderPickerSection {
  id: string
  /** The folding header of the block; null for none (the system folders) */
  label: string | null
  options: readonly FolderPickerOption[]
}

export interface FolderPickerLabels {
  title: string
  search: string
  /** Shown when no folder matches */
  empty: string
  /** Said after a folder with subfolders */
  collapsed: string
  expanded: string
  /** Said after the folder concerned */
  current: string
  /** The button creating a folder, when `onCreate` is given */
  create?: string
}

export interface FolderPickerProps {
  open: boolean
  labels: FolderPickerLabels
  sections: readonly FolderPickerSection[]
  /** Folders shown unfolded when it opens (the way to the current one) */
  initiallyExpandedIds?: readonly string[]
  onSelect: (option: FolderPickerOption) => void
  onClose: () => void
  /** A "New folder" button after the search (tf#899) */
  onCreate?: (() => void) | null
  testIds?: {
    dialog?: string
    create?: string
    input?: string
    listbox?: string
    option?: string
  }
}

const HEADER_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  py: 1,
  typography: 'caption',
  color: 'text.secondary'
} as const

const LIST_SX = { listStyle: 'none', m: 0, p: 0 } as const

function rowSx(
  option: FolderPickerOption,
  isActive: boolean,
  isPhone: boolean,
  isSearching: boolean
): Record<string, unknown> {
  const tall = option.subtitle !== undefined && option.subtitle !== null
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    minHeight: tall ? 52 : isPhone ? 40 : 36,
    px: 1,
    ml: isSearching ? 0 : `${String((option.level - 1) * 14)}px`,
    cursor: option.disabled === true ? 'default' : 'pointer',
    opacity: option.disabled === true ? 0.3 : 1,
    bgcolor: isActive ? 'action.selected' : 'transparent',
    '&:hover': {
      bgcolor: option.disabled === true ? undefined : 'action.hover'
    }
  }
}

const ICON_SX = {
  display: 'flex',
  color: 'text.icon',
  flexShrink: 0
} as const

const CHECK_SX = { ...ICON_SX, color: 'primary.main' } as const

const TEXT_SX = { flex: '1 1 auto', minWidth: 0 } as const

function nameSx(isCurrent: boolean): Record<string, unknown> {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    typography: 'body2',
    fontWeight: isCurrent ? 600 : undefined,
    color: 'text.primary'
  }
}

const SECONDARY_SX = {
  display: 'block',
  typography: 'caption',
  color: 'text.secondary',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

// 24 px to hit around a 12 px glyph: a click beside it picks the folder
const CHEVRON_SX = {
  display: 'flex',
  color: 'text.secondary',
  p: '6px',
  m: '-6px'
} as const

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase()
}

/** The options a section shows, folded subfolders left out */
function unfolded(
  options: readonly FolderPickerOption[],
  expanded: ReadonlySet<string>
): FolderPickerOption[] {
  const shown: FolderPickerOption[] = []
  let hiddenBelow: number | null = null
  for (const option of options) {
    if (hiddenBelow !== null && option.level > hiddenBelow) continue
    hiddenBelow = null
    shown.push(option)
    if (option.hasChildren && !expanded.has(option.id)) {
      hiddenBelow = option.level
    }
  }
  return shown
}

function isPickable(option: FolderPickerOption): boolean {
  return option.disabled !== true && option.isCurrent !== true
}

/**
 * Reached by the arrows: the pickable folders, and the others holding
 * subfolders (a team mailbox root), so ArrowRight can unfold them
 */
function isNavigable(
  option: FolderPickerOption,
  isSearching: boolean
): boolean {
  return isPickable(option) || (option.hasChildren && !isSearching)
}

/**
 * Asks for a folder, as tmail-flutter's destination picker. The focus goes
 * to the search field; Escape and the cross close it and give the focus
 * back to what opened it.
 */
export function FolderPicker({
  open,
  labels,
  sections,
  initiallyExpandedIds = [],
  onSelect,
  onClose,
  onCreate = null,
  testIds = {}
}: FolderPickerProps): ReactElement {
  const id = useId()
  const isPhone = useScreenSize() === 'mobile'
  const [filter, setFilter] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(initiallyExpandedIds)
  )
  const [foldedSections, setFoldedSections] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const isSearching = filter.trim() !== ''
  // The active folder is drawn once the keyboard moves or a search runs:
  // tmail-flutter highlights nothing when it opens
  const [hasNavigated, setHasNavigated] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // The search field takes the focus as soon as it is in the page
  useEffect(() => {
    if (!open) return undefined
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
    return () => {
      clearTimeout(timer)
    }
  }, [open])

  // Each opening starts afresh
  const wasOpen = useRef(open)
  useEffect(() => {
    if (open && !wasOpen.current) {
      setFilter('')
      setActiveId(null)
      setHasNavigated(false)
      setExpanded(new Set(initiallyExpandedIds))
      setFoldedSections(new Set())
    }
    wasOpen.current = open
  }, [open, initiallyExpandedIds])

  const shownSections = useMemo(() => {
    if (isSearching) {
      const words = normalize(filter).split(/\s+/).filter(Boolean)
      const options = sections
        .flatMap(section => section.options)
        .filter(option => {
          const text = normalize(
            `${option.label} ${option.secondary ?? ''} ${option.subtitle ?? ''}`
          )
          return words.every(word => text.includes(word))
        })
      return [{ id: 'results', label: null, options }]
    }
    return sections
      .filter(section => section.options.length > 0)
      .map(section => ({
        ...section,
        options: foldedSections.has(section.id)
          ? []
          : unfolded(section.options, expanded)
      }))
  }, [sections, isSearching, filter, expanded, foldedSections])

  const navigable = shownSections
    .flatMap(section => section.options)
    .filter(option => isNavigable(option, isSearching))
  const active =
    navigable.find(option => option.id === activeId) ??
    navigable.find(isPickable) ??
    navigable[0] ??
    null
  const optionDomId = (option: FolderPickerOption): string =>
    `${id}-option-${option.id}`
  const listboxDomId = (sectionId: string): string => `${id}-list-${sectionId}`

  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (active === null) return
    ;(bodyRef.current?.ownerDocument ?? document)
      .getElementById(optionDomId(active))
      ?.scrollIntoView({ block: 'nearest' })
    // optionDomId only depends on the stable id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const toggle = (optionId: string, isOpen: boolean): void => {
    setExpanded(current => {
      const next = new Set(current)
      if (isOpen) next.add(optionId)
      else next.delete(optionId)
      return next
    })
  }

  const move = (delta: number): void => {
    if (navigable.length === 0) return
    const index = active === null ? -1 : navigable.indexOf(active)
    // The first press shows the active folder where it is
    const next = !hasNavigated
      ? Math.max(index, 0)
      : (index + delta + navigable.length) % navigable.length
    setHasNavigated(true)
    setActiveId(navigable[next]?.id ?? null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter' && active !== null && hasNavigated) {
      event.preventDefault()
      // A folder only reached to unfold it is announced unavailable
      if (isPickable(active)) onSelect(active)
    } else if (
      !isSearching &&
      hasNavigated &&
      active !== null &&
      (event.key === 'ArrowRight' || event.key === 'ArrowLeft')
    ) {
      const isOpen = expanded.has(active.id)
      if (event.key === 'ArrowRight' && active.hasChildren && !isOpen) {
        event.preventDefault()
        toggle(active.id, true)
      } else if (event.key === 'ArrowLeft' && active.hasChildren && isOpen) {
        event.preventDefault()
        toggle(active.id, false)
      } else if (event.key === 'ArrowLeft' && active.parentId !== null) {
        event.preventDefault()
        setActiveId(active.parentId)
      }
    }
  }

  const listboxIds = shownSections
    .filter(section => section.options.length > 0)
    .map(section => listboxDomId(section.id))
  const isEmpty = shownSections.every(section => section.options.length === 0)

  return (
    <FixedDialog
      open={open}
      onClose={onClose}
      title={labels.title}
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
        <Box ref={bodyRef}>
          <Box className="u-flex u-flex-items-center u-mb-half">
            <SearchBar
              className="u-flex-auto"
              elevation={0}
              disabledClear
              placeholder={labels.search}
              value={filter}
              onChange={event => {
                setFilter(event.target.value)
                setActiveId(null)
                setHasNavigated(true)
              }}
              // This field can open over the form of another dialog
              onSubmit={event => {
                event.preventDefault()
                event.stopPropagation()
              }}
              componentsProps={{
                inputBase: {
                  inputRef,
                  inputProps: {
                    role: 'combobox',
                    'aria-label': labels.search,
                    'aria-expanded': true,
                    'aria-controls': listboxIds.join(' ') || undefined,
                    'aria-autocomplete': 'list',
                    'aria-activedescendant':
                      active === null || !hasNavigated
                        ? undefined
                        : optionDomId(active),
                    autoComplete: 'off',
                    onKeyDown: handleKeyDown,
                    'data-testid': testIds.input
                  }
                }
              }}
            />
            {onCreate === null ? null : (
              <Tooltip title={labels.create}>
                <IconButton
                  color="primary"
                  size="medium"
                  aria-label={labels.create}
                  onClick={onCreate}
                  data-testid={testIds.create}
                >
                  <Icon icon={Plus} aria-hidden="true" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          {shownSections.map((section, index) => {
            const isFolded = foldedSections.has(section.id)
            const headerId = `${id}-header-${section.id}`
            return (
              <Fragment key={section.id}>
                {index > 0 ? <Divider className="u-mv-half" /> : null}
                {section.label === null ? null : (
                  <ButtonBase
                    id={headerId}
                    aria-expanded={!isFolded}
                    aria-controls={listboxDomId(section.id)}
                    onClick={() => {
                      setFoldedSections(current => {
                        const next = new Set(current)
                        if (isFolded) next.delete(section.id)
                        else next.add(section.id)
                        return next
                      })
                    }}
                    sx={HEADER_SX}
                  >
                    {section.label}
                    <Box component="span" sx={CHEVRON_SX}>
                      <Icon
                        icon={isFolded ? Right : Bottom}
                        size={12}
                        aria-hidden="true"
                      />
                    </Box>
                  </ButtonBase>
                )}
                <Box
                  component="ul"
                  id={listboxDomId(section.id)}
                  role="listbox"
                  aria-label={section.label === null ? labels.title : undefined}
                  aria-labelledby={
                    section.label === null ? undefined : headerId
                  }
                  hidden={section.options.length === 0}
                  sx={LIST_SX}
                  data-testid={testIds.listbox}
                >
                  {section.options.map(option => {
                    const isActive = hasNavigated && option === active
                    const isOpen = expanded.has(option.id)
                    return (
                      <Box
                        component="li"
                        key={option.id}
                        id={optionDomId(option)}
                        role="option"
                        aria-selected={isActive}
                        aria-disabled={isPickable(option) ? undefined : true}
                        // Its state, out of its name: folded, current
                        aria-describedby={
                          [
                            option.hasChildren && !isSearching
                              ? `${id}-${isOpen ? 'expanded' : 'collapsed'}`
                              : null,
                            option.isCurrent === true ? `${id}-current` : null
                          ]
                            .filter(Boolean)
                            .join(' ') || undefined
                        }
                        onMouseDown={event => {
                          // The focus stays in the search field
                          event.preventDefault()
                        }}
                        onClick={() => {
                          if (isPickable(option)) onSelect(option)
                        }}
                        sx={rowSx(option, isActive, isPhone, isSearching)}
                        data-testid={testIds.option}
                        data-option-id={option.id}
                      >
                        {option.icon === undefined ||
                        option.icon === null ? null : (
                          <Box component="span" sx={ICON_SX}>
                            <Icon icon={option.icon} aria-hidden="true" />
                          </Box>
                        )}
                        <Box component="span" sx={TEXT_SX}>
                          <Box
                            component="span"
                            sx={nameSx(option.isCurrent === true)}
                          >
                            {option.label}
                            {option.hasChildren && !isSearching ? (
                              <>
                                <Box
                                  component="span"
                                  aria-hidden="true"
                                  sx={CHEVRON_SX}
                                  onClick={event => {
                                    event.stopPropagation()
                                    toggle(option.id, !isOpen)
                                  }}
                                >
                                  <Icon
                                    icon={isOpen ? Bottom : Right}
                                    size={12}
                                  />
                                </Box>
                              </>
                            ) : null}
                          </Box>
                          {option.subtitle === undefined ||
                          option.subtitle === null ? null : (
                            <Box component="span" sx={SECONDARY_SX}>
                              {option.subtitle}
                            </Box>
                          )}
                          {isSearching &&
                          option.secondary !== undefined &&
                          option.secondary !== null &&
                          option.secondary !== option.subtitle ? (
                            <Box component="span" sx={SECONDARY_SX}>
                              {option.secondary}
                            </Box>
                          ) : null}
                        </Box>
                        {option.isCurrent === true ? (
                          <Box component="span" sx={CHECK_SX}>
                            <Icon icon={Check} aria-hidden="true" />
                          </Box>
                        ) : null}
                      </Box>
                    )
                  })}
                </Box>
              </Fragment>
            )
          })}
          <Box component="span" hidden>
            <span id={`${id}-expanded`}>{labels.expanded}</span>
            <span id={`${id}-collapsed`}>{labels.collapsed}</span>
            <span id={`${id}-current`}>{labels.current}</span>
          </Box>
          {isEmpty ? (
            <Typography role="status" variant="body2" className="u-ph-2 u-pv-1">
              {labels.empty}
            </Typography>
          ) : null}
        </Box>
      }
    />
  )
}
