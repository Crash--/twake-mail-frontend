// Upstream to twake-ui: yes. A conversation (emails, chat threads, comment
// threads) is a list of collapsible messages; twake-mui has an `Accordion`
// from MUI, whose summary is a full-width button but whose look (cards,
// expand icon on the side, elevation) and missing keyboard moves between
// items do not fit a message list.
import { Box } from '@linagora/twake-mui'
import type { KeyboardEvent, ReactElement, ReactNode } from 'react'

/** Attribute marking the toggles the arrows move between */
export const MESSAGE_TOGGLE_ATTRIBUTE = 'data-message-toggle'

const LIST_SX = { listStyle: 'none', m: 0, p: 0 } as const

/** Index of the toggle each key moves the focus to */
const MOVES: Readonly<
  Record<string, (index: number, count: number) => number>
> = {
  ArrowDown: index => index + 1,
  ArrowUp: index => index - 1,
  Home: () => 0,
  End: (_index, count) => count - 1
}

export interface MessageThreadProps {
  /** Accessible name of the list, e.g. "Messages of the conversation" */
  label: string
  /** `MessageThreadItem`s */
  children: ReactNode
  'data-testid'?: string
}

/**
 * The messages of a conversation, in an ordered list. ArrowDown and
 * ArrowUp move the focus to the next or previous message, Home and End to
 * the first or last, from the toggle of a message.
 */
export function MessageThread({
  label,
  children,
  'data-testid': testId
}: MessageThreadProps): ReactElement {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const target = event.target
    if (
      !(target instanceof HTMLElement) ||
      !target.hasAttribute(MESSAGE_TOGGLE_ATTRIBUTE)
    ) {
      return
    }
    const move = MOVES[event.key]
    if (move === undefined) return
    const toggles = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        `[${MESSAGE_TOGGLE_ATTRIBUTE}]`
      )
    ]
    event.preventDefault()
    toggles[move(toggles.indexOf(target), toggles.length)]?.focus()
  }

  return (
    <Box
      component="ol"
      aria-label={label}
      sx={LIST_SX}
      onKeyDown={handleKeyDown}
      data-testid={testId}
    >
      {children}
    </Box>
  )
}
