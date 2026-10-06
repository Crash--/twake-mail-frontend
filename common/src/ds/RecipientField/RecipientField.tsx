// Upstream to twake-ui: yes. twake-mui has no field of chips with
// suggestions; Mail (recipients), Calendar (attendees) and Drive (sharing)
// all need one. The ARIA 1.2 combobox of `SearchCombobox`, with the chips
// of what was already entered before the input.
import { Cross, Icon, Warning } from '@linagora/twake-icons'
import { Box, InputBase, Paper, Popper, Typography } from '@linagora/twake-mui'
// Not twake-mui's Chip: it drops its ref, which the keyboard needs to move
// the focus between chips (docs/twake-mui-gaps.md)
import Chip from '@mui/material/Chip'
import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref
} from 'react'

import { FIELD_LABEL_SX, FIELD_LINE_SX } from '@/ds/FieldLine/FieldLine'
import { RecipientAvatar } from './RecipientAvatar'

const POPUP_SX = { zIndex: 'modal' } as const
const PAPER_SX = { maxHeight: 320, overflowY: 'auto' } as const
const LIST_SX = { listStyle: 'none', m: 0, p: 0 } as const
const OPTION_SX = {
  px: 2,
  py: 1,
  cursor: 'pointer',
  '&[aria-selected="true"]': { bgcolor: 'action.selected' },
  '&:hover': { bgcolor: 'action.hover' }
} as const
/**
 * The line keeps its end actions on the first row: the label, chips and
 * input wrap in a box of their own
 */
const LINE_SX = {
  ...FIELD_LINE_SX,
  flexWrap: 'nowrap',
  alignItems: 'flex-start'
} as const
/**
 * The label stands beside the chips, not in their wrapping row: a chip as
 * wide as the field keeps the label company on the first row instead of
 * leaving it alone above
 */
const LABEL_SX = {
  ...FIELD_LABEL_SX,
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  height: 28
} as const
/**
 * The input follows the last chip on its row while `INPUT_MIN_WIDTH` is
 * left, and only then goes to the next row
 */
/** Beside 32 px chips, the 28 px label stays centred on the first row */
const CHIPS_LABEL_SX = { ...LABEL_SX, mt: '2px' } as const
const INPUT_MIN_WIDTH = 56
const INPUT_SX = { flex: `1 1 ${INPUT_MIN_WIDTH}px`, minWidth: INPUT_MIN_WIDTH }
/** Rows of chips shown before the field scrolls (32 px chips, 4 px apart) */
const MAX_CHIP_ROWS = 3
const CHIP_HEIGHT = 32
const CHIP_GAP = 4
const CONTENT_SX = {
  minWidth: 0,
  // With hundreds of recipients the field keeps its place in the window: it
  // scrolls inside, and the focused chip or the input scrolls into view
  maxHeight: MAX_CHIP_ROWS * CHIP_HEIGHT + (MAX_CHIP_ROWS - 1) * CHIP_GAP,
  overflowY: 'auto',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: `${CHIP_GAP}px`,
  rowGap: `${CHIP_GAP}px`,
  minHeight: 28
} as const
const ACTIONS_SX = { gap: '7px', height: 28, flexShrink: 0 } as const
/** Figma "Teammail 1.1" recipient chip: 32 px high, grey, rounded */
export const RECIPIENT_CHIP_SX = {
  height: 32,
  maxWidth: '100%',
  borderRadius: '10px',
  bgcolor: 'background.default',
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: '0.25px',
  '& .MuiChip-avatar': { ml: '6px', mr: '-2px' },
  '& .MuiChip-deleteIcon': { color: 'text.secondary', flexShrink: 0 }
} as const
export const INVALID_CHIP_SX = {
  ...RECIPIENT_CHIP_SX,
  borderColor: 'error.main',
  bgcolor: 'background.paper'
} as const

/** Something already entered in the field */
export interface RecipientFieldChip {
  id: string
  /** What the chip shows (a name, or the address) */
  label: string
  /** The full text, shown on hover (`Name <address>`) */
  title?: string
  /** Not usable as is: shown in red, with an icon, and said in its name */
  isInvalid: boolean
  /** Shows a decorative avatar of this name before the label */
  avatar?: string
}

/** A suggestion of the list under the field */
export interface RecipientFieldSuggestion {
  id: string
  label: string
  secondary?: string
}

export interface RecipientFieldLabels {
  /** Visible label of the field ("To") */
  field: string
  /** Name of the list of suggestions */
  suggestions: string
  /** Appended to the name of an invalid chip */
  invalid: string
  /** How to act on a chip, read after its name */
  chipHelp: string
  /** Announced when a chip is removed */
  removed: (label: string) => string
  /**
   * Announced when chips are added: the labels of the new ones, in order
   * (a pasted list can add hundreds)
   */
  added: (labels: readonly string[]) => string
}

/** What a parent can do to the field */
export interface RecipientFieldActions {
  focus: () => void
}

export interface RecipientFieldProps {
  labels: RecipientFieldLabels
  chips: readonly RecipientFieldChip[]
  inputValue: string
  onInputChange: (value: string) => void
  /**
   * Turns text into chips (and empties the input): Enter, a comma, a
   * semicolon, leaving the field, or pasting a list (see `isList`)
   */
  onCommit: (text: string) => void
  onRemove: (id: string) => void
  /** The chip goes back into the input, to be corrected */
  onEdit: (id: string) => void
  /**
   * Escape while a chip is edited: the chip comes back as it was and the
   * input is emptied (the field does not touch its input itself)
   */
  onCancelEdit: () => void
  suggestions: readonly RecipientFieldSuggestion[]
  onSelectSuggestion: (id: string) => void
  /** Whether pasted text holds several entries, committed at once */
  isList?: (text: string) => boolean
  /** Announced politely, e.g. the number of suggestions */
  status?: string
  /** At the end of the line, e.g. buttons showing other fields */
  endActions?: ReactNode
  onFocus?: () => void
  /** Takes the focus once shown */
  autoFocus?: boolean
  actions?: Ref<RecipientFieldActions>
  testIds?: {
    field?: string
    input?: string
    chip?: string
    listbox?: string
  }
}

/**
 * A field of chips with suggestions (ARIA 1.2 combobox, "list autocomplete
 * with manual selection"), for recipients, attendees, people to share with:
 *
 * - the input (`role="combobox"`) is named by the visible label; ArrowDown
 *   and ArrowUp move in the suggestions, Enter picks one or commits the
 *   text, as do a comma, a semicolon, leaving the field and pasting a list;
 *   Escape closes the suggestions, and only then reaches the page;
 * - the chips are out of the tab order: ArrowLeft (or Backspace) at the
 *   start of the input goes to the last one, arrows move between them,
 *   Delete or Backspace removes one (announced), Enter, F2 or a double
 *   click edits it; Escape then gives the chip back as it was, and stops
 *   there (a second Escape reaches the page);
 * - an invalid chip says so in its accessible name and with an icon, not
 *   by its colour only.
 */
export function RecipientField({
  labels,
  chips,
  inputValue,
  onInputChange,
  onCommit,
  onRemove,
  onEdit,
  onCancelEdit,
  suggestions,
  onSelectSuggestion,
  isList,
  status,
  endActions,
  onFocus,
  autoFocus = false,
  actions,
  testIds = {}
}: RecipientFieldProps): ReactElement {
  const id = useId()
  const inputId = `${id}-input`
  const labelId = `${id}-label`
  const listboxId = `${id}-listbox`
  const chipHelpId = `${id}-chip-help`
  const rootRef = useRef<HTMLDivElement>(null)
  const [field, setField] = useState<HTMLDivElement | null>(null)
  const [content, setContent] = useState<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chipRefs = useRef<(HTMLDivElement | null)[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  /** Chip to focus once the chips change (after a removal), -1 for the input */
  const pendingFocus = useRef<number | null>(null)
  /**
   * Backspace in the input moved the focus to a chip: the key going up
   * there must not remove it (MUI's Chip deletes on key up)
   */
  const skipDeleteKeyUp = useRef(false)
  /** A chip was taken back into the input, and not committed since */
  const isEditing = useRef(false)
  const previousIds = useRef<readonly string[] | null>(null)
  /** The chips changed because an edit was cancelled: nothing was added */
  const isRestoring = useRef(false)

  useImperativeHandle(
    actions,
    () => ({
      focus: () => {
        inputRef.current?.focus()
      }
    }),
    []
  )

  const isShown = isOpen && suggestions.length > 0
  const activeIndex = suggestions.findIndex(option => option.id === activeId)
  const active = isShown ? (suggestions[activeIndex] ?? null) : null
  const optionId = (optionKey: string): string => `${id}-option-${optionKey}`

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
    // Once shown only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const index = pendingFocus.current
    if (index === null) return
    pendingFocus.current = null
    const chip = index >= 0 ? chipRefs.current[index] : null
    if (chip) {
      chip.focus()
    } else {
      inputRef.current?.focus()
    }
  }, [chips])

  // Chips added above the input push it down in the scrolled field
  useEffect(() => {
    const input = inputRef.current
    if (input !== null && input.ownerDocument.activeElement === input) {
      input.scrollIntoView({ block: 'nearest' })
    }
  }, [chips.length])

  useEffect(() => {
    if (active === null) return
    // The document the field is rendered in, maybe not this window's
    ;(rootRef.current?.ownerDocument ?? document)
      .getElementById(optionId(active.id))
      ?.scrollIntoView({ block: 'nearest' })
    // optionId only depends on the stable id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // Adding chips is announced as removing one is
  useEffect(() => {
    const before = previousIds.current
    previousIds.current = chips.map(chip => chip.id)
    if (before === null) return
    const known = new Set(before)
    const added = chips.filter(chip => !known.has(chip.id))
    const restored = isRestoring.current
    isRestoring.current = false
    if (added.length > 0 && !restored) {
      setAnnouncement(labels.added(added.map(chip => chip.label)))
    }
    // The text is the caller's: only a change of the chips is said
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chips])

  const close = (): void => {
    setIsOpen(false)
    setActiveId(null)
  }

  const commit = (text: string): void => {
    if (text.trim() === '') return
    close()
    isEditing.current = false
    onCommit(text)
  }

  const select = (suggestion: RecipientFieldSuggestion): void => {
    close()
    isEditing.current = false
    onSelectSuggestion(suggestion.id)
    inputRef.current?.focus()
  }

  const move = (delta: number): void => {
    if (suggestions.length === 0) return
    setIsOpen(true)
    const next =
      activeIndex === -1
        ? delta > 0
          ? 0
          : suggestions.length - 1
        : (activeIndex + delta + suggestions.length) % suggestions.length
    setActiveId(suggestions[next]?.id ?? null)
  }

  const focusChip = (index: number): void => {
    if (index < 0) return
    if (index >= chips.length) {
      inputRef.current?.focus()
      return
    }
    chipRefs.current[index]?.focus()
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const input = event.currentTarget
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0
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
        } else if (inputValue.trim() !== '') {
          event.preventDefault()
          commit(inputValue)
        }
        break
      case ',':
      case ';':
        if (inputValue.trim() !== '') {
          event.preventDefault()
          commit(inputValue)
        }
        break
      case 'Backspace':
      case 'ArrowLeft':
        if (atStart && chips.length > 0) {
          event.preventDefault()
          close()
          skipDeleteKeyUp.current = event.key === 'Backspace'
          focusChip(chips.length - 1)
        }
        break
      case 'Escape':
        // One thing at a time: the suggestions close and the chip being
        // edited comes back together, then Escape is the page's again
        if (isShown || isEditing.current) {
          event.preventDefault()
          event.stopPropagation()
          close()
          if (isEditing.current) {
            isEditing.current = false
            isRestoring.current = true
            onCancelEdit()
          }
        }
        break
      default:
        break
    }
  }

  const removeChip = (index: number): void => {
    const chip = chips[index]
    if (!chip) return
    // The next chip takes the focus, or the input after the last one
    pendingFocus.current = index < chips.length - 1 ? index : -1
    setAnnouncement(labels.removed(chip.label))
    onRemove(chip.id)
  }

  const editChip = (index: number): void => {
    const chip = chips[index]
    if (!chip) return
    pendingFocus.current = -1
    isEditing.current = true
    onEdit(chip.id)
  }

  const handleChipKeyDown =
    (index: number) =>
    (event: KeyboardEvent<HTMLDivElement>): void => {
      skipDeleteKeyUp.current = false
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          focusChip(Math.max(index - 1, 0))
          break
        case 'ArrowRight':
          event.preventDefault()
          focusChip(index + 1)
          break
        case 'F2':
          event.preventDefault()
          editChip(index)
          break
        default:
          break
      }
    }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    const pasted = event.clipboardData.getData('text')
    if (!isList?.(pasted)) return
    event.preventDefault()
    const input = event.currentTarget
    const start = input.selectionStart ?? inputValue.length
    const end = input.selectionEnd ?? inputValue.length
    commit(`${inputValue.slice(0, start)}${pasted}${inputValue.slice(end)}`)
  }

  const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget
    if (next !== null && rootRef.current?.contains(next)) return
    close()
    isEditing.current = false
    commit(inputValue)
  }

  // Clicks in the suggestions keep the focus in the input
  const keepFocus = (event: { preventDefault: () => void }): void => {
    event.preventDefault()
  }

  const handleFieldClick = (event: { target: EventTarget }): void => {
    // A click in the empty part of the field goes to the input
    if (event.target === field || event.target === content) {
      inputRef.current?.focus()
    }
  }

  return (
    <Box ref={rootRef} onBlur={handleBlur} data-testid={testIds.field}>
      {/* The chips belong to the field the label names */}
      <Box
        ref={setField}
        role="group"
        aria-labelledby={labelId}
        sx={LINE_SX}
        onClick={handleFieldClick}
      >
        <Typography
          component="label"
          id={labelId}
          htmlFor={inputId}
          variant="body2"
          sx={chips.length === 0 ? LABEL_SX : CHIPS_LABEL_SX}
        >
          {labels.field}
        </Typography>
        <Box ref={setContent} className="u-flex-auto" sx={CONTENT_SX}>
          {chips.map((chip, index) => (
            <Chip
              key={chip.id}
              ref={(element: HTMLDivElement | null) => {
                chipRefs.current[index] = element
              }}
              size="small"
              variant={chip.isInvalid ? 'outlined' : 'filled'}
              avatar={
                chip.isInvalid || chip.avatar === undefined ? undefined : (
                  <RecipientAvatar of={chip.avatar} />
                )
              }
              icon={
                chip.isInvalid ? (
                  <Icon icon={Warning} aria-hidden="true" />
                ) : undefined
              }
              deleteIcon={<Icon icon={Cross} size={12} aria-hidden="true" />}
              label={chip.label}
              title={chip.title ?? chip.label}
              aria-label={
                chip.isInvalid ? `${chip.label}, ${labels.invalid}` : chip.label
              }
              aria-describedby={chipHelpId}
              tabIndex={-1}
              // Enter (a click without a pointer) or a double click edits;
              // a single click only selects the chip
              onClick={event => {
                if (event.detail === 0) editChip(index)
              }}
              onDoubleClick={() => {
                editChip(index)
              }}
              onDelete={(event: { type: string }) => {
                if (event.type === 'keyup' && skipDeleteKeyUp.current) {
                  skipDeleteKeyUp.current = false
                  return
                }
                removeChip(index)
              }}
              onKeyDown={handleChipKeyDown(index)}
              sx={chip.isInvalid ? INVALID_CHIP_SX : RECIPIENT_CHIP_SX}
              data-testid={testIds.chip}
              data-invalid={chip.isInvalid ? 'true' : undefined}
            />
          ))}
          <InputBase
            inputRef={inputRef}
            value={inputValue}
            onChange={event => {
              setIsOpen(true)
              setActiveId(null)
              onInputChange(event.target.value)
            }}
            onFocus={() => {
              setIsOpen(true)
              onFocus?.()
            }}
            onPaste={handlePaste}
            sx={INPUT_SX}
            inputProps={{
              id: inputId,
              role: 'combobox',
              'aria-expanded': isShown,
              'aria-controls': isShown ? listboxId : undefined,
              'aria-autocomplete': 'list',
              'aria-activedescendant':
                active === null ? undefined : optionId(active.id),
              autoComplete: 'off',
              spellCheck: false,
              onKeyDown: handleInputKeyDown,
              'data-testid': testIds.input
            }}
          />
        </Box>
        {endActions === undefined ? null : (
          <Box className="u-flex u-flex-items-center" sx={ACTIONS_SX}>
            {endActions}
          </Box>
        )}
      </Box>
      <Popper
        open={isShown}
        anchorEl={field}
        placement="bottom-start"
        // Next to the field: inside the focus trap of a dialog holding it
        disablePortal
        sx={{ ...POPUP_SX, width: field?.offsetWidth }}
      >
        <Paper elevation={8} sx={PAPER_SX} onMouseDown={keepFocus}>
          <Box
            component="ul"
            id={listboxId}
            role="listbox"
            aria-label={labels.suggestions}
            sx={LIST_SX}
            data-testid={testIds.listbox}
          >
            {suggestions.map(suggestion => (
              <Box
                component="li"
                key={suggestion.id}
                id={optionId(suggestion.id)}
                role="option"
                aria-selected={active?.id === suggestion.id}
                sx={OPTION_SX}
                onClick={() => {
                  select(suggestion)
                }}
              >
                <Typography noWrap>{suggestion.label}</Typography>
                {suggestion.secondary === undefined ? null : (
                  <Typography variant="body2" noWrap color="text.primary">
                    {suggestion.secondary}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Paper>
      </Popper>
      <Box id={chipHelpId} className="u-visuallyhidden">
        {labels.chipHelp}
      </Box>
      {/* Always mounted: a live region only announces changes */}
      <Box role="status" className="u-visuallyhidden">
        {announcement}
        {isShown && status ? ` ${status}` : null}
      </Box>
    </Box>
  )
}
