// Upstream to twake-ui: yes. twake-mui has no emoji picker; every Twake app
// that writes text (Mail, Chat, Calendar descriptions) needs the same one.
// The emoji data is given by the caller (it is language dependent and heavy:
// the caller loads it lazily), so the component bundles no dataset.
import { Box, InputBase, Popover, Typography } from '@linagora/twake-mui'
import {
  useDeferredValue,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement
} from 'react'

import { FOCUS_RING_INSET } from '@/ds/FocusIndicator/focusIndicator'

export const EMOJI_GROUPS = [
  'people',
  'animals',
  'food',
  'activities',
  'travel',
  'objects',
  'symbols',
  'flags'
] as const

export type EmojiGroupId = (typeof EMOJI_GROUPS)[number]

export interface EmojiEntry {
  /** The emoji itself */
  char: string
  /** Its name in the language of the UI, the first search target */
  label: string
  tags: readonly string[]
  group: EmojiGroupId
}

export interface EmojiPickerLabels {
  /** Accessible name of the popover */
  title: string
  search: string
  noResults: string
  loading: string
  recent: string
  /** Name of the list of categories */
  categories: string
  groups: Record<EmojiGroupId, string>
}

export interface EmojiPickerProps {
  /** The button the popover opens above; null when closed */
  anchor: HTMLElement | null
  /** Null while the data loads */
  emojis: readonly EmojiEntry[] | null
  /** Last used emojis, most recent first */
  recent: readonly string[]
  labels: EmojiPickerLabels
  onPick: (emoji: string) => void
  onClose: () => void
  'data-testid'?: string
}

/** Pictograms of the categories tabs, in the order of the design */
const TAB_GLYPHS: Record<EmojiGroupId | 'recent', string> = {
  recent: '🕘',
  people: '😀',
  animals: '🐻',
  food: '🍔',
  activities: '⚽',
  travel: '🚗',
  objects: '💡',
  symbols: '🔣',
  flags: '🏳️'
}

const COLUMNS = 8
const CELL = 36

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

interface Section {
  id: EmojiGroupId | 'recent' | 'results'
  title: string
  items: readonly { char: string; label: string }[]
}

/**
 * An emoji picker in a popover: categories, search, grid. The search field
 * has the focus on opening; the grid is one tab stop and the arrows move in
 * it; Enter or a click picks; Escape and a click outside close.
 */
export function EmojiPicker({
  anchor,
  onClose,
  labels,
  ...content
}: EmojiPickerProps): ReactElement {
  return (
    <Popover
      open={anchor !== null}
      anchorEl={anchor}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      disableRestoreFocus
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-label': labels.title,
          sx: { borderRadius: 2, mt: -1 }
        }
      }}
    >
      {/* Mounted while open only: a search or a position never outlives it */}
      <EmojiPickerContent labels={labels} {...content} />
    </Popover>
  )
}

type EmojiPickerContentProps = Omit<EmojiPickerProps, 'anchor' | 'onClose'>

function EmojiPickerContent({
  emojis,
  recent,
  labels,
  onPick,
  'data-testid': testId
}: EmojiPickerContentProps): ReactElement {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [activeChar, setActiveChar] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState<Section['id']>('recent')
  const scrollRef = useRef<HTMLDivElement>(null)
  const headingPrefix = useId()

  const sections = useMemo<Section[]>(() => {
    if (emojis === null) return []
    const search = normalize(deferredQuery)
    if (search !== '') {
      const matches = emojis.filter(
        emoji =>
          normalize(emoji.label).includes(search) ||
          emoji.tags.some(tag => normalize(tag).includes(search))
      )
      return [{ id: 'results', title: '', items: matches }]
    }
    const byChar = new Map(emojis.map(emoji => [emoji.char, emoji]))
    const recents = recent.flatMap(char => {
      const emoji = byChar.get(char)
      return emoji ? [emoji] : []
    })
    const groups = EMOJI_GROUPS.map<Section>(group => ({
      id: group,
      title: labels.groups[group],
      items: emojis.filter(emoji => emoji.group === group)
    }))
    return [
      ...(recents.length > 0
        ? [{ id: 'recent' as const, title: labels.recent, items: recents }]
        : []),
      ...groups
    ]
  }, [emojis, deferredQuery, recent, labels])

  // The tab stop of the grid: the active emoji, else the first
  const firstKey = sections[0]?.items[0]
    ? `${sections[0].id}:${sections[0].items[0].char}`
    : null
  const tabKey =
    activeChar !== null &&
    sections.some(section =>
      section.items.some(item => `${section.id}:${item.char}` === activeChar)
    )
      ? activeChar
      : firstKey

  const focusButton = (button: HTMLButtonElement | undefined): void => {
    if (!button) return
    setActiveChar(button.dataset.key ?? null)
    button.focus()
    button.scrollIntoView({ block: 'nearest' })
  }

  const handleGridKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    // Not `instanceof`: the picker may be rendered in another document
    const current = event.target as HTMLButtonElement
    if (current.tagName !== 'BUTTON' || !current.dataset.emoji) return
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-emoji]')
    )
    const index = buttons.indexOf(current)
    const rect = current.getBoundingClientRect()
    const vertical = (direction: 1 | -1): HTMLButtonElement | undefined => {
      let best: HTMLButtonElement | undefined
      let bestScore = Number.POSITIVE_INFINITY
      for (const button of buttons) {
        const other = button.getBoundingClientRect()
        const gap =
          direction === 1 ? other.top - rect.bottom : rect.top - other.bottom
        if (gap < -1) continue
        const score = gap * 1000 + Math.abs(other.left - rect.left)
        if (score < bestScore) {
          best = button
          bestScore = score
        }
      }
      return best
    }
    let target: HTMLButtonElement | undefined
    switch (event.key) {
      case 'ArrowRight':
        target = buttons[index + 1]
        break
      case 'ArrowLeft':
        target = buttons[index - 1]
        break
      case 'ArrowDown':
        target = vertical(1)
        break
      case 'ArrowUp':
        target = vertical(-1)
        break
      case 'Home':
        target = buttons[0]
        break
      case 'End':
        target = buttons[buttons.length - 1]
        break
      default:
        return
    }
    event.preventDefault()
    focusButton(target)
  }

  const goToSection = (id: Section['id']): void => {
    setActiveGroup(id)
    const heading = scrollRef.current?.querySelector(`[data-section="${id}"]`)
    heading?.scrollIntoView({ block: 'start' })
  }

  const handleScroll = (): void => {
    const container = scrollRef.current
    if (!container) return
    const top = container.getBoundingClientRect().top
    const passed = Array.from(
      container.querySelectorAll<HTMLElement>('[data-section]')
    ).filter(element => element.getBoundingClientRect().top - top <= 8)
    const current = passed[passed.length - 1]?.dataset.section
    if (current !== undefined) setActiveGroup(current as Section['id'])
  }

  const tabs = sections.filter(section => section.id !== 'results')

  return (
    <>
      <Box
        data-testid={testId}
        sx={{
          width: `min(${COLUMNS * CELL + 2 * 8 + 12 + 16}px, calc(100vw - 16px))`,
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1
        }}
      >
        <Box
          role="group"
          aria-label={labels.categories}
          sx={{ display: 'flex', justifyContent: 'space-between' }}
        >
          {tabs.map(section => (
            <Box
              key={section.id}
              component="button"
              type="button"
              aria-label={section.title}
              aria-current={activeGroup === section.id ? 'true' : undefined}
              title={section.title}
              onClick={() => {
                goToSection(section.id)
              }}
              data-testid={testId ? `${testId}-tab-${section.id}` : undefined}
              sx={{
                width: 32,
                height: 32,
                p: 0,
                border: 0,
                borderBottom: '2px solid',
                borderColor:
                  activeGroup === section.id ? 'primary.main' : 'transparent',
                bgcolor: 'transparent',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
                filter: activeGroup === section.id ? 'none' : 'grayscale(1)',
                opacity: activeGroup === section.id ? 1 : 0.7
              }}
            >
              <span aria-hidden="true">
                {TAB_GLYPHS[section.id as keyof typeof TAB_GLYPHS]}
              </span>
            </Box>
          ))}
        </Box>
        <InputBase
          autoFocus
          type="search"
          value={query}
          placeholder={labels.search}
          onChange={event => {
            setQuery(event.target.value)
          }}
          inputProps={{
            'aria-label': labels.search,
            'data-testid': testId ? `${testId}-search` : undefined
          }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              focusButton(
                scrollRef.current?.querySelector<HTMLButtonElement>(
                  '[data-emoji]'
                ) ?? undefined
              )
            }
          }}
          sx={{
            px: 1.5,
            height: 40,
            borderRadius: 5,
            bgcolor: 'action.hover'
          }}
        />
        <Box
          ref={scrollRef}
          onScroll={handleScroll}
          onKeyDown={handleGridKeyDown}
          sx={{ height: 280, overflowY: 'auto', pr: '4px' }}
        >
          {emojis === null ? (
            <Typography
              role="status"
              variant="body2"
              color="textSecondary"
              sx={{ p: 1 }}
            >
              {labels.loading}
            </Typography>
          ) : sections.length === 1 &&
            sections[0]?.id === 'results' &&
            sections[0].items.length === 0 ? (
            <Typography
              role="status"
              variant="body2"
              color="textSecondary"
              sx={{ p: 1 }}
            >
              {labels.noResults}
            </Typography>
          ) : (
            sections.map(section => (
              <Box
                key={section.id}
                component="section"
                aria-labelledby={
                  section.title ? `${headingPrefix}-${section.id}` : undefined
                }
                aria-label={section.title ? undefined : labels.search}
                data-section={section.id}
                sx={{
                  contentVisibility: 'auto',
                  containIntrinsicSize: 'auto 200px'
                }}
              >
                {section.title ? (
                  <Typography
                    id={`${headingPrefix}-${section.id}`}
                    component="h3"
                    variant="caption"
                    color="textSecondary"
                    sx={{ display: 'block', py: 0.5 }}
                  >
                    {section.title}
                  </Typography>
                ) : null}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${COLUMNS}, ${CELL}px)`
                  }}
                >
                  {section.items.map(item => (
                    <Box
                      key={item.char}
                      data-key={`${section.id}:${item.char}`}
                      component="button"
                      type="button"
                      aria-label={item.label}
                      title={item.label}
                      data-emoji={item.char}
                      tabIndex={
                        `${section.id}:${item.char}` === tabKey ? 0 : -1
                      }
                      onClick={() => {
                        onPick(item.char)
                      }}
                      onFocus={() => {
                        setActiveChar(`${section.id}:${item.char}`)
                      }}
                      sx={{
                        width: CELL,
                        height: CELL,
                        p: 0,
                        border: 0,
                        borderRadius: 1,
                        bgcolor: 'transparent',
                        cursor: 'pointer',
                        fontSize: 24,
                        lineHeight: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                        ...FOCUS_RING_INSET
                      }}
                    >
                      <span aria-hidden="true">{item.char}</span>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </>
  )
}
