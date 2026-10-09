// Upstream to twake-ui: no, the look of tmail-flutter's destination picker
// (`DestinationPickerView`): a 556 px dialog rounded by 16 px (the whole
// screen of a phone), the close cross at the start of a 52 px bar and the
// title in its middle in Bold 20, a filled grey search field, then the
// folders by blocks (the system ones, "Personal folders", "Team-mailboxes",
// the last two folding), 36 px rows with a 20 px blue icon and the subfolders
// folded behind a chevron after the name. twake-mui has no such picker.
//
// Accessibility: the search field is a combobox (ARIA 1.2) driving one
// listbox per block; ArrowDown / ArrowUp move the active folder, ArrowRight
// and ArrowLeft unfold and fold its subfolders, Enter picks it; the headers
// of the blocks are buttons (`aria-expanded`).
import { Icon, type IconProps } from '@linagora/twake-icons'
import {
  Box,
  ButtonBase,
  Dialog,
  IconButton,
  InputBase,
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

import { Bottom, Check, Magnifier, Right } from '@/ds/FlutterIcons/FlutterIcons'
import { TMAIL } from '@/ds/TmailColors/tmailColors'
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
  close: string
  search: string
  /** Shown when no folder matches */
  empty: string
  /** Said after a folder with subfolders */
  collapsed: string
  expanded: string
  /** Said after the folder concerned */
  current: string
}

export interface FolderPickerProps {
  open: boolean
  labels: FolderPickerLabels
  sections: readonly FolderPickerSection[]
  /** Folders shown unfolded when it opens (the way to the current one) */
  initiallyExpandedIds?: readonly string[]
  onSelect: (option: FolderPickerOption) => void
  onClose: () => void
  testIds?: {
    dialog?: string
    close?: string
    input?: string
    listbox?: string
    option?: string
  }
}

const PRIMARY = TMAIL.primary
const DIVIDER = TMAIL.divider12

function paperSx(isPhone: boolean): Record<string, unknown> {
  return isPhone
    ? { borderRadius: '16px 16px 0 0', m: 0, mt: '12px' }
    : {
        width: 556,
        maxWidth: 'calc(100% - 32px)',
        height: 'min(656px, calc(100dvh - 24px))',
        maxHeight: 'calc(100dvh - 24px)',
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
  height: 52,
  px: '56px',
  borderBottom: `1px solid ${DIVIDER}`
} as const

const CLOSE_SX = {
  position: 'absolute',
  left: 8,
  top: '50%',
  transform: 'translateY(-50%)',
  color: TMAIL.greyLavender
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

const BODY_SX = { flex: '1 1 auto', overflowY: 'auto', pb: '12px' } as const

const SEARCH_SX = {
  display: 'flex',
  alignItems: 'center',
  height: 44,
  m: '16px',
  borderRadius: '10px',
  bgcolor: TMAIL.fillToolbar,
  color: TMAIL.grey,
  '& .MuiInputBase-root': {
    flex: '1 1 auto',
    fontSize: 17,
    color: TMAIL.textBlack
  },
  '& .MuiInputBase-input::placeholder': { color: TMAIL.grey, opacity: 1 }
} as const

const MAGNIFIER_SX = { display: 'flex', px: '8px' } as const

const HEADER_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  px: '16px',
  py: '8px',
  fontSize: 14,
  lineHeight: '18px',
  color: TMAIL.textBlack,
  borderRadius: '8px'
} as const

const SECTION_DIVIDER_SX = {
  height: '1px',
  bgcolor: DIVIDER,
  mx: '6px',
  my: '8px'
} as const

const LIST_SX = { listStyle: 'none', m: 0, px: '16px', py: 0 } as const

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
    gap: isPhone ? '8px' : '16px',
    minHeight: tall ? 52 : isPhone ? 40 : 36,
    px: '10px',
    ml: isSearching ? 0 : `${String((option.level - 1) * 14)}px`,
    borderRadius: isPhone ? '10px' : '8px',
    cursor: option.disabled === true ? 'default' : 'pointer',
    opacity: option.disabled === true ? 0.3 : 1,
    bgcolor: isActive ? TMAIL.fillF2 : 'transparent',
    '&:hover': {
      bgcolor: option.disabled === true ? undefined : TMAIL.fillEB
    }
  }
}

const ICON_SX = { display: 'flex', color: PRIMARY, flexShrink: 0 } as const

const TEXT_SX = { flex: '1 1 auto', minWidth: 0 } as const

function nameSx(isCurrent: boolean): Record<string, unknown> {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: 14,
    lineHeight: '18px',
    fontWeight: isCurrent ? 700 : 400,
    color: TMAIL.textBlack
  }
}

const SECONDARY_SX = {
  display: 'block',
  fontSize: 14,
  lineHeight: '18px',
  color: TMAIL.grey,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
} as const

const CHEVRON_SX = {
  display: 'flex',
  color: TMAIL.textBlack,
  p: '3px'
} as const

/** `ic_composer_close`: two 2 px strokes, 24 px */
function CloseIcon(): ReactElement {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
  testIds = {}
}: FolderPickerProps): ReactElement {
  const id = useId()
  const titleId = `${id}-title`
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
    .filter(isPickable)
  const active =
    navigable.find(option => option.id === activeId) ?? navigable[0] ?? null
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
      onSelect(active)
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
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isPhone}
      // The search field takes the focus once the dialog is in
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
        <Tooltip title={labels.close}>
          <IconButton
            aria-label={labels.close}
            onClick={onClose}
            sx={CLOSE_SX}
            data-testid={testIds.close}
          >
            <CloseIcon />
          </IconButton>
        </Tooltip>
        <Typography id={titleId} component="h2" sx={TITLE_SX}>
          {labels.title}
        </Typography>
      </Box>
      <Box ref={bodyRef} sx={BODY_SX}>
        <Box sx={SEARCH_SX}>
          <Box component="span" sx={MAGNIFIER_SX}>
            <Icon icon={Magnifier} size={24} aria-hidden="true" />
          </Box>
          <InputBase
            inputRef={inputRef}
            placeholder={labels.search}
            value={filter}
            onChange={event => {
              setFilter(event.target.value)
              setActiveId(null)
              setHasNavigated(true)
            }}
            inputProps={{
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
            }}
          />
        </Box>
        {shownSections.map((section, index) => {
          const isFolded = foldedSections.has(section.id)
          const headerId = `${id}-header-${section.id}`
          return (
            <Fragment key={section.id}>
              {index > 0 ? <Box sx={SECTION_DIVIDER_SX} /> : null}
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
                      size={17}
                      aria-hidden="true"
                    />
                  </Box>
                </ButtonBase>
              )}
              <Box
                component="ul"
                id={listboxDomId(section.id)}
                role="listbox"
                aria-labelledby={section.label === null ? titleId : headerId}
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
                          <Icon
                            icon={option.icon}
                            size={20}
                            aria-hidden="true"
                          />
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
                                  size={17}
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
                        <>
                          <Box component="span" sx={ICON_SX}>
                            <Icon icon={Check} size={20} aria-hidden="true" />
                          </Box>
                        </>
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
    </Dialog>
  )
}
