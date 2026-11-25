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

/** The header and what is under it: one surface for the hover */
const HEADER_SX = { '&:hover': { bgcolor: 'action.hover' } } as const

const ROW_SX = {
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-start'
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
  isInset: boolean,
  isLocked: boolean
): SxProps<Theme> {
  const { side, phoneSide } = sides(isInset)
  return {
    // Scrolled to, a message stops below the sticky bar of the conversation;
    // inset, the bar is above the scrolling area
    scrollMarginTop: isInset ? 0 : '4rem',
    display: 'block',
    width: '100%',
    textAlign: 'start',
    position: 'static',
    pl: side,
    pr: hasHeaderEnd ? 0 : side,
    py: isExpanded ? 0 : 1,
    pt: isExpanded ? '20px' : undefined,
    pb: isExpanded ? '4px' : undefined,
    borderRadius: 1,
    ...(isLocked ? { cursor: 'default' } : {}),
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

/**
 * The heading around the toggle (APG accordion): it takes the place of the
 * toggle in the row and draws nothing of its own
 */
function headingSx(hasHeaderEnd: boolean): SxProps<Theme> {
  return {
    m: 0,
    font: 'inherit',
    minWidth: 0,
    flex: hasHeaderEnd ? '0 1 auto' : 1
  }
}

/** After the toggle, on its line: clicks go through, but to its buttons */
const HEADER_END_SX = {
  position: 'relative',
  flex: 1,
  minWidth: 0,
  pt: '20px',
  // No higher than the toggle beside it while it holds one line, with or
  // without a button on it (the avatar hangs below the line): what is under
  // the row moves down when the line wraps instead of covering it
  pb: '9px',
  pl: 0,
  pr: '16px',
  // A long name or address breaks rather than overflowing the pane
  overflowWrap: 'anywhere',
  pointerEvents: 'none',
  '& button, & a': { pointerEvents: 'auto' },
  [PHONE]: { pt: '16px', pb: 0, pr: '12px' }
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
/** Under the header row, aligned with the message below */
const HEADER_BELOW_SX = { px: 2 } as const
const INSET_HEADER_BELOW_SX = { px: '8px' } as const

export interface MessageThreadItemProps {
  isExpanded: boolean
  onToggle: () => void
  /**
   * False: an expanded message stays so (the only one of its conversation),
   * its header neither collapses it nor lights up on hover
   */
  isCollapsible?: boolean
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
  /**
   * Under the header row, outside the toggle, in the surface of its hover:
   * e.g. the recipients of an expanded message
   */
  headerBelow?: ReactNode
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
 * `aria-controls`), in a level-2 heading, that expands or collapses the
 * message, shown below it in a region named by the header. A message that
 * cannot collapse keeps the button, `aria-disabled` as the APG accordion
 * says of a panel that stays open.
 */
export function MessageThreadItem({
  isExpanded,
  onToggle,
  isCollapsible = true,
  header,
  headerEnd,
  actions,
  headerBelow,
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
  const isLocked = isExpanded && !isCollapsible

  return (
    <Box
      component="li"
      sx={ITEM_SX}
      data-testid={testId}
      data-expanded={isExpanded ? 'true' : 'false'}
    >
      <Box sx={isLocked ? undefined : HEADER_SX}>
        <Box sx={ROW_SX}>
          <Box component="h2" sx={headingSx(hasHeaderEnd)}>
            <ButtonBase
              ref={toggleRef}
              id={toggleId}
              aria-expanded={isExpanded}
              aria-controls={regionId}
              aria-disabled={isLocked ? true : undefined}
              onClick={isLocked ? undefined : onToggle}
              disableRipple={isLocked}
              sx={toggleSx(isExpanded, hasHeaderEnd, isInset, isLocked)}
              {...toggleProps}
              data-testid={toggleTestId}
            >
              {header}
            </ButtonBase>
          </Box>
          {hasHeaderEnd ? <Box sx={HEADER_END_SX}>{headerEnd}</Box> : null}
          {actions === undefined || actions === null ? null : (
            <Box sx={actionsSx(isExpanded, isInset)}>{actions}</Box>
          )}
        </Box>
        {headerBelow === undefined || headerBelow === null ? null : (
          <Box sx={isInset ? INSET_HEADER_BELOW_SX : HEADER_BELOW_SX}>
            {headerBelow}
          </Box>
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
