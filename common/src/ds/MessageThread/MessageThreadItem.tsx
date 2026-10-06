// Upstream to twake-ui: yes, with `MessageThread`.
import { Box, ButtonBase } from '@linagora/twake-mui'
import { useId, type ReactElement, type ReactNode, type Ref } from 'react'

import { MESSAGE_TOGGLE_ATTRIBUTE } from './MessageThread'

const ITEM_SX = {
  borderTop: 1,
  borderColor: 'divider',
  '&:first-of-type': { borderTop: 0 }
} as const

const ROW_SX = {
  display: 'flex',
  alignItems: 'flex-start',
  '&:hover': { bgcolor: 'action.hover' }
} as const

const ACTIONS_SX = { flex: 'none', pt: 0.75, pr: 1 } as const

const REGION_SX = { px: 2, pb: 1 } as const

const TOGGLE_SX = {
  // Scrolled to, a message stops below the sticky bar of the conversation
  scrollMarginTop: '4rem',
  display: 'block',
  flex: 1,
  minWidth: 0,
  textAlign: 'start',
  px: 2,
  py: 1,
  borderRadius: 1,
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
  /**
   * The icon buttons at the end of the header row: beside the toggle, not in
   * it (a button cannot hold buttons)
   */
  actions?: ReactNode
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
  actions,
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
      <Box sx={ROW_SX}>
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
        {actions === undefined || actions === null ? null : (
          <Box sx={ACTIONS_SX}>{actions}</Box>
        )}
      </Box>
      <Box
        id={regionId}
        role="region"
        aria-labelledby={toggleId}
        hidden={!isExpanded}
        sx={REGION_SX}
      >
        {isExpanded ? children : null}
      </Box>
    </Box>
  )
}
