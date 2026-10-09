// Upstream to twake-ui: no, the look of tmail-flutter's folder tile in
// Settings > Folder visibility: a 40 px row (52 px with a second line), no
// divider, a 20 px folder icon, the name in Inter 14 / 18, an expand button
// right after the name, the action at the end, and the subfolders 10 px
// further in. twake-mui's `ListItem` has neither the metrics nor the nested
// expand button.
import { Icon, type IconProps } from '@linagora/twake-icons'
import { Box, IconButton, Tooltip } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'
import { Bottom, Right } from '@/ds/FlutterIcons/FlutterIcons'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

/** tmail-flutter's `steelGrayA540`, `steelGray200` and `steelGray400` */
const ICON_COLOR = TMAIL.steel
const ICON_MUTED_COLOR = TMAIL.greyFaint
const TEXT_MUTED_COLOR = TMAIL.grey

/** The nested list of a row, or of a category: no bullet, 10 px further in */
export const NESTED_LIST_SX = {
  listStyle: 'none',
  m: 0,
  p: 0,
  pl: '10px'
} as const

const ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  px: '12px',
  borderRadius: '8px',
  '&:hover': { bgcolor: 'action.hover' }
} as const

const NAME_SX = {
  fontSize: 14,
  lineHeight: '18px',
  letterSpacing: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0
} as const

const EXPAND_SX = { p: '3px', color: 'inherit' } as const

export interface FolderVisibilityExpand {
  isExpanded: boolean
  /** Tooltip and accessible name, e.g. "Expand" */
  label: string
  onToggle: () => void
  /** Id of the list of subfolders (`aria-controls`) */
  controlsId: string
  'data-testid'?: string
}

export interface FolderVisibilityRowProps {
  /** The name of the folder */
  name: string
  /** Before the name, greyed when `isMuted`; none for a team mailbox */
  icon?: IconProps['icon'] | null
  /** The folder is hidden: grey icon and name */
  isMuted?: boolean
  /** A second line under the name, e.g. the address of a team mailbox */
  secondary?: string | null
  secondaryTestId?: string
  /** The expand button after the name, for a folder with subfolders */
  expand?: FolderVisibilityExpand | null
  /** At the end of the row, e.g. "Hide" */
  action?: ReactNode
  /** The rows of the subfolders, shown while expanded */
  children?: ReactNode
  'data-testid'?: string
  /** Data attributes of the item, e.g. `data-hidden` */
  dataAttributes?: Partial<Record<`data-${string}`, string>>
}

/** A folder of the visibility settings, a list item, with its subfolders */
export function FolderVisibilityRow({
  name,
  icon = null,
  isMuted = false,
  secondary = null,
  secondaryTestId,
  expand = null,
  action,
  children,
  'data-testid': testId,
  dataAttributes
}: FolderVisibilityRowProps): ReactElement {
  const nameColor = isMuted ? TEXT_MUTED_COLOR : TMAIL.textBlack
  const expandButton =
    expand === null ? null : (
      <Tooltip title={expand.label}>
        <IconButton
          size="small"
          aria-label={expand.label}
          aria-expanded={expand.isExpanded}
          aria-controls={expand.controlsId}
          onClick={expand.onToggle}
          sx={EXPAND_SX}
          data-testid={expand['data-testid']}
        >
          <Icon icon={expand.isExpanded ? Bottom : Right} size={17} />
        </IconButton>
      </Tooltip>
    )
  return (
    <Box component="li" data-testid={testId} {...dataAttributes}>
      <Box sx={{ ...ROW_SX, minHeight: secondary === null ? 40 : 52 }}>
        {icon === null ? null : (
          <Box
            component="span"
            className="u-flex u-flex-shrink-0"
            sx={{ color: isMuted ? ICON_MUTED_COLOR : ICON_COLOR }}
          >
            <Icon icon={icon} size={20} aria-hidden="true" />
          </Box>
        )}
        <Box className="u-flex u-flex-column u-flex-auto" sx={{ minWidth: 0 }}>
          <Box className="u-flex u-flex-items-center" sx={{ minWidth: 0 }}>
            <Box component="span" sx={{ ...NAME_SX, color: nameColor }}>
              {name}
            </Box>
            {expandButton}
          </Box>
          {secondary === null ? null : (
            <Box
              component="span"
              sx={{ ...NAME_SX, color: TEXT_MUTED_COLOR }}
              data-testid={secondaryTestId}
            >
              {secondary}
            </Box>
          )}
        </Box>
        {action}
      </Box>
      {expand?.isExpanded === true ? (
        <Box component="ul" id={expand.controlsId} sx={NESTED_LIST_SX}>
          {children}
        </Box>
      ) : null}
    </Box>
  )
}
