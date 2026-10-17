// Upstream to twake-ui: maybe, as a `ButtonBase` option. twake-mui has no
// target for the mouse alone: a second way to reach a control the keyboard
// already reaches nearby (the avatar of a sender opening the card its name
// opens), with no second tab stop nor a second name read.
import { ButtonBase } from '@linagora/twake-mui'
import type { MouseEvent, ReactElement, ReactNode } from 'react'

export interface PointerShortcutProps {
  /** What is clicked: an avatar, an icon */
  children: ReactNode
  onClick: () => void
  'data-testid'?: string
}

/**
 * Makes its content clickable with a mouse or a finger only: out of the tab
 * order and hidden from assistive technologies, for a control the keyboard
 * reaches elsewhere (its `onClick` should hand the focus to that control).
 */
export function PointerShortcut({
  children,
  onClick,
  'data-testid': testId
}: PointerShortcutProps): ReactElement {
  // A click does not leave the focus on a target the keyboard cannot reach
  const handleMouseDown = (event: MouseEvent): void => {
    event.preventDefault()
  }
  return (
    <ButtonBase
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      disableRipple
      onMouseDown={handleMouseDown}
      onClick={onClick}
      data-testid={testId}
      sx={{ borderRadius: '50%' }}
    >
      {children}
    </ButtonBase>
  )
}
