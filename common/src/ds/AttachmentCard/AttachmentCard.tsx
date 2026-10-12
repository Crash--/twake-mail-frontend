// Upstream to twake-ui: no, the look of tmail-flutter's attachments
// (`AttachmentItemWidget`, `EmailAttachmentsWidget`): 260 x 36 px chips with a
// light border, the file icon, the name cut in the middle (its extension
// stays), the size and a blue download button; on a desktop the chips that
// fit on one row, then "Show +N more"; on a phone three of them, one under
// the other. Meanwhile local, on twake-mui `ButtonBase`, `IconButton` and
// `Tooltip`.
import { Icon } from '@linagora/twake-icons'
import { Box, ButtonBase, IconButton, Tooltip } from '@linagora/twake-mui'
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { Attachment, Download } from '@/ds/FlutterIcons/FlutterIcons'
import { TMAIL } from '@/ds/TmailColors/tmailColors'

/** `EmailUtils.desktopItemMaxWidth`, `attachmentItemHeight`, `…Spacing` */
export const ATTACHMENT_CARD_WIDTH = 260
const CHIP_HEIGHT = 36
const SPACING = 8
/** Room kept for "Show +N more" and its icon on the row (`EmailUtils`) */
const MORE_BUTTON_MAX_WIDTH = 150
const ICON_SIZE = 20
/** Shown before "+N more" on a phone, or before the row is measured */
export const COLLAPSED_ATTACHMENT_COUNT = 3

const HOVER = TMAIL.hoverOnSurface08

const CHIP_SX = {
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  width: ATTACHMENT_CARD_WIDTH,
  maxWidth: '100%',
  height: CHIP_HEIGHT,
  pl: 1,
  pr: 1,
  border: `1px solid ${TMAIL.outlineCard}`,
  borderRadius: '8px',
  '&:hover': { bgcolor: HOVER }
} as const

const MAIN_SX = {
  display: 'flex',
  alignItems: 'center',
  flex: '1 1 auto',
  minWidth: 0,
  height: '100%',
  gap: 1,
  justifyContent: 'flex-start',
  textAlign: 'start',
  borderRadius: '6px',
  '& .AttachmentCard-icon svg': { width: ICON_SIZE, height: ICON_SIZE }
} as const

const NAME_SX = {
  display: 'flex',
  flex: '1 1 auto',
  minWidth: 0,
  color: TMAIL.textOnSurface,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  letterSpacing: '0.1px',
  whiteSpace: 'nowrap'
} as const

const SIZE_SX = {
  flexShrink: 0,
  ml: 1,
  mr: '3px',
  color: TMAIL.steelLight,
  fontSize: 11,
  fontWeight: 500,
  lineHeight: '16px',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap'
} as const

const DOWNLOAD_SX = {
  flexShrink: 0,
  p: '7px',
  color: TMAIL.primary,
  '& svg': { width: 16, height: 16 }
} as const

const TEXT_BUTTON_SX = {
  height: CHIP_HEIGHT,
  px: '10px',
  gap: 1,
  borderRadius: '5px',
  color: TMAIL.grey,
  fontSize: 16,
  fontWeight: 500,
  lineHeight: '20px',
  whiteSpace: 'nowrap',
  '&:hover': { bgcolor: HOVER },
  '& .AttachmentCard-icon': { color: TMAIL.steel, display: 'flex' }
} as const

/** "report.final.pdf" → ["report.final", ".pdf"]: the extension stays */
function splitName(name: string): [string, string] {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || name.length - dot > 8) return [name, '']
  return [name.slice(0, dot), name.slice(dot)]
}

export interface AttachmentCardProps {
  name: string
  /** Formatted size, e.g. "12 KB" */
  size: string
  /** The file type icon, drawn at 20 px */
  thumbnail: ReactNode
  /** Accessible name prefix of the chip, e.g. "Preview" or "Download" */
  openLabel: string
  /** Accessible name and tooltip of the download action, e.g. "Download" */
  downloadLabel: string
  onOpen: () => void
  onDownload: () => void
  'data-testid'?: string
}

/**
 * A file attached to a message. The chip opens the file (its accessible
 * name says what the click does: "Preview report.pdf (12 KB)"); the
 * download action is a second button at its end.
 */
export function AttachmentCard({
  name,
  size,
  thumbnail,
  openLabel,
  downloadLabel,
  onOpen,
  onDownload,
  'data-testid': testId
}: AttachmentCardProps): ReactElement {
  const [stem, extension] = splitName(name)
  return (
    <Box sx={CHIP_SX} data-testid={testId}>
      <ButtonBase
        sx={MAIN_SX}
        onClick={onOpen}
        title={name}
        aria-label={`${openLabel} ${name} (${size})`}
        data-testid={testId ? `${testId}-open` : undefined}
      >
        <Box
          component="span"
          className="AttachmentCard-icon u-flex u-flex-shrink-0"
          aria-hidden="true"
        >
          {thumbnail}
        </Box>
        <Box component="span" sx={NAME_SX} aria-hidden="true">
          <Box component="span" className="u-ellipsis" sx={{ minWidth: 0 }}>
            {stem}
          </Box>
          <Box component="span" sx={{ flexShrink: 0 }}>
            {extension}
          </Box>
        </Box>
        <Box component="span" sx={SIZE_SX} aria-hidden="true">
          {size}
        </Box>
      </ButtonBase>
      <Tooltip title={downloadLabel}>
        <IconButton
          aria-label={`${downloadLabel} ${name}`}
          onClick={onDownload}
          sx={DOWNLOAD_SX}
          data-testid={testId ? `${testId}-download` : undefined}
        >
          <Icon icon={Download} aria-hidden="true" />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

export interface AttachmentTextButtonProps {
  /** E.g. "Show +5 more", "Hide 5" */
  label: string
  onClick: () => void
  'data-testid'?: string
}

/** "Show +N more" and "Hide N": the paperclip, then grey text */
export function AttachmentTextButton({
  label,
  onClick,
  'data-testid': testId
}: AttachmentTextButtonProps): ReactElement {
  return (
    <ButtonBase sx={TEXT_BUTTON_SX} onClick={onClick} data-testid={testId}>
      <span className="AttachmentCard-icon" aria-hidden="true">
        <Icon icon={Attachment} size={16} />
      </span>
      {label}
    </ButtonBase>
  )
}

/**
 * How many chips tmail-flutter shows collapsed in a row `width` px wide
 * (`EmailUtils.getAttachmentDisplayed`): all when they fit, else those that
 * fit beside the "+N more" button, at least one. Three on a phone, or while
 * the width is unknown.
 */
export function visibleAttachmentCount(
  count: number,
  width: number | null,
  isPhone: boolean
): number {
  if (isPhone || width === null || width <= 0) {
    return Math.min(count, COLLAPSED_ATTACHMENT_COUNT)
  }
  const needed = count * ATTACHMENT_CARD_WIDTH + (count - 1) * SPACING
  if (needed <= width) return count
  const available = width - MORE_BUTTON_MAX_WIDTH - ICON_SIZE - SPACING * 4
  let used = 0
  let visible = 0
  for (let index = 0; index < count; index += 1) {
    const next = ATTACHMENT_CARD_WIDTH + (index > 0 ? SPACING : 0)
    if (used + next > available) break
    used += next
    visible += 1
  }
  return Math.max(visible, 1)
}

/** The width of an element, followed as it changes; null until measured */
export function useElementWidth(): {
  ref: (element: HTMLElement | null) => void
  width: number | null
} {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    if (element === null) return undefined
    const measure = (): void => {
      setWidth(element.getBoundingClientRect().width)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [element])
  return { ref: setElement, width }
}

/**
 * The chips of an email: a wrapping row on a desktop and a tablet (its runs
 * spaced only once expanded), a column on a phone
 */
export function AttachmentCardRow({
  children,
  isColumn = false,
  isExpanded = false,
  rowRef,
  'data-testid': testId
}: {
  children: ReactNode
  isColumn?: boolean
  isExpanded?: boolean
  /** Measures the room of the row */
  rowRef?: (element: HTMLElement | null) => void
  'data-testid'?: string
}): ReactElement {
  return (
    <Box
      ref={rowRef}
      sx={
        isColumn
          ? {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: `${SPACING}px`
            }
          : {
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: `${SPACING}px`,
              rowGap: isExpanded ? `${SPACING}px` : 0
            }
      }
      data-testid={testId}
    >
      {children}
    </Box>
  )
}

export interface AttachmentHeaderProps {
  /** E.g. "2 Attachments (37 kB)" */
  title: string
  /** "Download all", when the server offers it */
  action?: ReactNode
}

/** The header of the attachments: a grey paperclip and the count */
export function AttachmentHeader({
  title,
  action
}: AttachmentHeaderProps): ReactElement {
  return (
    <Box className="u-flex u-flex-items-center">
      <Box
        component="span"
        className="u-flex u-flex-shrink-0"
        sx={{ color: TMAIL.greyStar }}
        aria-hidden="true"
      >
        <Icon icon={Attachment} size={14} />
      </Box>
      <Box
        component="h3"
        className="u-ellipsis"
        sx={{
          flex: '1 1 auto',
          minWidth: 0,
          m: 0,
          ml: 1,
          mr: '3px',
          color: TMAIL.greyIcon,
          fontSize: 15,
          fontWeight: 400,
          lineHeight: '20px',
          letterSpacing: '-0.24px'
        }}
      >
        {title}
      </Box>
      {action}
    </Box>
  )
}

/**
 * Around the header and the chips, the room of tmail-flutter: 28 px above
 * (12, after the 16 under the headers), none below (the body keeps 16), 12 px
 * between them, 4 px in from the body
 */
export function AttachmentListFrame({
  header,
  children,
  'data-testid': testId
}: {
  header: ReactNode
  children: ReactNode
  'data-testid'?: string
}): ReactElement {
  return (
    <Box sx={{ pt: '28px', px: '4px' }} data-testid={testId}>
      {header}
      <Box sx={{ mt: '12px' }}>{children}</Box>
    </Box>
  )
}

export interface AttachmentDownloadAllProps {
  label: string
  onClick: () => void
  'data-testid'?: string
}

/** "Download all": grey text, the download icon after it */
export function AttachmentDownloadAll({
  label,
  onClick,
  'data-testid': testId
}: AttachmentDownloadAllProps): ReactElement {
  return (
    <ButtonBase
      sx={{
        ...TEXT_BUTTON_SX,
        height: 'auto',
        py: '3px',
        px: '5px',
        flexShrink: 0
      }}
      onClick={onClick}
      data-testid={testId}
    >
      {label}
      <span className="AttachmentCard-icon" aria-hidden="true">
        <Icon icon={Download} size={16} />
      </span>
    </ButtonBase>
  )
}
