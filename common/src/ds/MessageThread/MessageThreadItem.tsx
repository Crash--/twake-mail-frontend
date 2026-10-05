// Upstream to twake-ui: yes, with `MessageThread`.
import { Box, ButtonBase } from '@linagora/twake-mui'
import { useId, type ReactElement, type ReactNode, type Ref } from 'react'

import { MESSAGE_TOGGLE_ATTRIBUTE } from './MessageThread'

const ITEM_SX = {
  borderTop: 1,
  borderColor: 'divider',
  '&:first-of-type': { borderTop: 0 }
} as const

const TOGGLE_SX = {
  // Scrolled to, a message stops below the sticky bar of the conversation
  scrollMarginTop: '3.5rem',
  display: 'block',
  width: '100%',
  textAlign: 'start',
  px: 1,
  py: 1,
  borderRadius: 1,
  '&:hover': { bgcolor: 'action.hover' },
  '&.Mui-focusVisible': {
    outline: 2,
    outlineColor: 'primary.main',
    outlineOffset: -2
  },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' }
} as const

export interface MessageThreadItemProps {
  isExpanded: boolean
  onToggle: () => void
  /** The header: sender, date, and the preview while collapsed */
  header: ReactNode
  /** The message, shown while expanded */
  children: ReactNode
  'data-testid'?: string
  /** Test id of the toggle */
  toggleTestId?: string
  /** The toggle, e.g. to give it the focus once the message collapsed */
  toggleRef?: Ref<HTMLButtonElement>
}

/**
 * A message of a conversation: its header is a button (`aria-expanded`,
 * `aria-controls`) that expands or collapses the message, shown below it in
 * a region named by the header.
 */
export function MessageThreadItem({
  isExpanded,
  onToggle,
  header,
  children,
  'data-testid': testId,
  toggleTestId,
  toggleRef
}: MessageThreadItemProps): ReactElement {
  const id = useId()
  const toggleId = `${id}-toggle`
  const regionId = `${id}-region`
  const toggleProps = { [MESSAGE_TOGGLE_ATTRIBUTE]: '' }

  return (
    <Box
      component="li"
      sx={ITEM_SX}
      data-testid={testId}
      data-expanded={isExpanded ? 'true' : 'false'}
    >
      <ButtonBase
        ref={toggleRef}
        id={toggleId}
        aria-expanded={isExpanded}
        aria-controls={regionId}
        onClick={onToggle}
        sx={TOGGLE_SX}
        {...toggleProps}
        data-testid={toggleTestId}
      >
        {header}
      </ButtonBase>
      <Box
        id={regionId}
        role="region"
        aria-labelledby={toggleId}
        hidden={!isExpanded}
        className="u-ph-1 u-pb-1"
      >
        {isExpanded ? children : null}
      </Box>
    </Box>
  )
}
