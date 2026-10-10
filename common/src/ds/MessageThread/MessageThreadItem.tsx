// Upstream to twake-ui: yes, with `MessageThread`.
import { Box, ButtonBase, type SxProps, type Theme } from '@linagora/twake-mui'
import { useId, type ReactElement, type ReactNode, type Ref } from 'react'

import {
  FOCUS_RING,
  FOCUS_RING_INSET
} from '@/ds/FocusIndicator/focusIndicator'
import { useIsReadingInset } from '@/ds/ReadingPane/ReadingPane'
import { SCREEN_QUERIES } from '@/ds/useScreenSize/useScreenSize'

import { MESSAGE_TOGGLE_ATTRIBUTE } from './MessageThread'

const ITEM_SX = {
  borderTop: 1,
  borderColor: 'divider',
  '&:first-of-type': { borderTop: 0 }
} as const

const ROW_SX = {
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-start',
  '&:hover': { bgcolor: 'action.hover' }
} as const

/**
 * tmail-flutter (`InformationSenderAndReceiverBuilder`): 16 px around an
 * expanded header (12 on a phone), whose name line is 28 px high (the name
 * button has 4 px above and below); a collapsed one keeps 8 px above and
 * below
 */
const PHONE = `@media ${SCREEN_QUERIES.mobile}`

// Inset, the row keeps 8 px so that its hover and its focus ring do not
// touch the avatar
function sides(isInset: boolean): { side: string; phoneSide: string } {
  return isInset
    ? { side: '8px', phoneSide: '8px' }
    : { side: '16px', phoneSide: '12px' }
}

function toggleSx(
  isExpanded: boolean,
  hasHeaderEnd: boolean,
  isInset: boolean
): SxProps<Theme> {
  const { side, phoneSide } = sides(isInset)
  return {
    // Scrolled to, a message stops below the sticky bar of the conversation;
    // inset, the bar is above the scrolling area
    scrollMarginTop: isInset ? 0 : '4rem',
    display: 'block',
    flex: hasHeaderEnd ? '0 1 auto' : 1,
    minWidth: 0,
    textAlign: 'start',
    position: 'static',
    pl: side,
    pr: hasHeaderEnd ? 0 : side,
    py: isExpanded ? 0 : 1,
    pt: isExpanded ? '20px' : undefined,
    pb: isExpanded ? '4px' : undefined,
    borderRadius: 1,
    [PHONE]: {
      pl: phoneSide,
      pr: hasHeaderEnd ? 0 : phoneSide,
      pt: isExpanded ? '16px' : undefined
    },
    // The toggle covers the whole row; what the header adds after it and the
    // actions sit above
    '&::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      borderRadius: 1
    },
    '&.Mui-focusVisible': { outline: 'none' },
    '&.Mui-focusVisible::after': { ...FOCUS_RING, ...FOCUS_RING_INSET },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' }
  }
}

/** After the toggle, on its line: clicks go through, but to its buttons */
const HEADER_END_SX = {
  position: 'relative',
  flex: 1,
  minWidth: 0,
  pt: '20px',
  pl: 0,
  pr: '16px',
  pointerEvents: 'none',
  '& button, & a': { pointerEvents: 'auto' },
  [PHONE]: { pt: '16px', pr: '12px' }
} as const

/**
 * The 36 px buttons centred on the name line: 12 px down in an expanded
 * header (16 + 14 - 18), none in a collapsed one (8 + 10 - 18), as far from
 * the end as the toggle from the start
 */
function actionsSx(isExpanded: boolean, isInset: boolean): SxProps<Theme> {
  const { side, phoneSide } = sides(isInset)
  return {
    position: 'relative',
    flex: 'none',
    pt: isExpanded ? '12px' : 0,
    pr: side,
    [PHONE]: { pt: isExpanded ? '8px' : 0, pr: phoneSide }
  }
}

const REGION_SX = { px: 2, pb: 1 } as const
const INSET_REGION_SX = { px: '8px', pb: 1 } as const

export interface MessageThreadItemProps {
  isExpanded: boolean
  onToggle: () => void
  /** The header: sender, date, and the preview while collapsed */
  header: ReactNode
  /**
   * After the header, on its first line, outside the toggle: what holds
   * buttons, e.g. the address of the sender as the button of its card
   */
  headerEnd?: ReactNode
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
  headerEnd,
  actions,
  children,
  'data-testid': testId,
  toggleTestId,
  toggleRef
}: MessageThreadItemProps): ReactElement {
  const isInset = useIsReadingInset()
  const id = useId()
  const toggleId = `${id}-toggle`
  const regionId = `${id}-region`
  const toggleProps = { [MESSAGE_TOGGLE_ATTRIBUTE]: '' }
  const hasHeaderEnd = headerEnd !== undefined && headerEnd !== null

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
          sx={toggleSx(isExpanded, hasHeaderEnd, isInset)}
          {...toggleProps}
          data-testid={toggleTestId}
        >
          {header}
        </ButtonBase>
        {hasHeaderEnd ? <Box sx={HEADER_END_SX}>{headerEnd}</Box> : null}
        {actions === undefined || actions === null ? null : (
          <Box sx={actionsSx(isExpanded, isInset)}>{actions}</Box>
        )}
      </Box>
      <Box
        id={regionId}
        role="region"
        aria-labelledby={toggleId}
        hidden={!isExpanded}
        sx={isInset ? INSET_REGION_SX : REGION_SX}
      >
        {isExpanded ? children : null}
      </Box>
    </Box>
  )
}
