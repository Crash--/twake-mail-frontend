// Upstream to twake-ui: no, tmail-flutter's attachment chips
// (`AttachmentItemWidget`, `EmailAttachmentsWidget`): 260 x 36 px chips with a
// light border, the file icon, the name cut in the middle (its extension
// stays), the size and a blue download button; on a desktop the chips that
// fit on one row, then "Show +N more"; on a phone three of them, one under
// the other. Meanwhile local, on twake-mui `ButtonBase`, `IconButton` and
// `Tooltip`.
import {
  Icon,
  AddToCloud,
  Attachment,
  CheckCircle,
  Download
} from '@linagora/twake-icons'
import {
  Box,
  ButtonBase,
  CircularProgress,
  IconButton,
  radius,
  Tooltip
} from '@linagora/twake-mui'
import {
  useEffect,
  useState,
  type DragEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode
} from 'react'

/** `EmailUtils.desktopItemMaxWidth`, `attachmentItemHeight`, `…Spacing` */
export const ATTACHMENT_CARD_WIDTH = 260
const CHIP_HEIGHT = 36
const SPACING = 8
/** Room kept for "Show +N more" and its icon on the row (`EmailUtils`) */
const MORE_BUTTON_MAX_WIDTH = 150
const ICON_SIZE = 20
/** Shown before "+N more" on a phone, or before the row is measured */
export const COLLAPSED_ATTACHMENT_COUNT = 3

const CHIP_SX = {
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  width: ATTACHMENT_CARD_WIDTH,
  maxWidth: '100%',
  height: CHIP_HEIGHT,
  pl: 1,
  pr: 1,
  border: 1,
  borderColor: 'divider',
  borderRadius: radius.md,
  '&:hover': { bgcolor: 'action.hover' }
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
  borderRadius: radius.sm,
  '& .AttachmentCard-icon svg': { width: ICON_SIZE, height: ICON_SIZE }
} as const

const NAME_SX = {
  display: 'flex',
  flex: '1 1 auto',
  minWidth: 0,
  typography: 'subtitle1',
  color: 'text.primary',
  whiteSpace: 'nowrap'
} as const

const SIZE_SX = {
  flexShrink: 0,
  ml: 1,
  mr: '3px',
  typography: 'overline',
  // The line height overline had before twake-mui 18.5, the Figma gives none
  lineHeight: '16px',
  color: 'text.secondary',
  whiteSpace: 'nowrap'
} as const

const DOWNLOAD_SX = {
  flexShrink: 0,
  p: '7px',
  color: 'primary.main',
  '& svg': { width: 16, height: 16 }
} as const

/** A saved file: the chip turns green, as in Twake Calendar */
const SAVED_CHIP_SX = {
  ...CHIP_SX,
  bgcolor: 'rgb(var(--twake-palette-success-mainChannel) / 0.08)',
  '&:hover': {
    bgcolor: 'rgb(var(--twake-palette-success-mainChannel) / 0.12)'
  }
} as const

/** As Twake Calendar: a grey cloud, a green check of 18 px */
const SAVE_SX = {
  ...DOWNLOAD_SX,
  color: 'text.secondary',
  '&.AttachmentCard-saved': { color: 'success.main' },
  '&.AttachmentCard-saved svg': { width: 18, height: 18 }
} as const

const SAVED_STATUS_SX = {
  display: 'inline-flex',
  flexShrink: 0,
  p: '6px',
  color: 'success.main'
} as const

const TEXT_BUTTON_SX = {
  height: CHIP_HEIGHT,
  px: '10px',
  gap: 1,
  borderRadius: radius.sm,
  typography: 'button',
  color: 'text.secondary',
  whiteSpace: 'nowrap',
  '&:hover': { bgcolor: 'action.hover' },
  '& .AttachmentCard-icon': { color: 'text.icon', display: 'flex' }
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
  /**
   * Makes the chip draggable (into a message being written): sets what
   * the drag carries
   */
  onDragStart?: (event: DragEvent<HTMLElement>) => void
  /** Saving the file elsewhere (to a Drive), before the download action */
  save?: AttachmentSave | null
  'data-testid'?: string
}

/**
 * The save action of a chip, with the API of twake-mui's
 * `SaveToDriveButton`: a cloud with a plus, a spinner while it saves, then
 * a green check, a button when the saved file can be opened
 */
export interface AttachmentSave {
  status: 'idle' | 'saving' | 'saved'
  /**
   * Accessible name and tooltip: "Save to my Drive", "Saving to Drive…",
   * "File saved to your Drive" (`saved`), "See in Drive" (`open`)
   */
  labels: { idle: string; saving: string; saved: string; open: string }
  onSave: (event: MouseEvent<HTMLButtonElement>) => void
  /** Without it, `saved` is a status, not a button */
  onOpen?: (event: MouseEvent<HTMLButtonElement>) => void
}

/**
 * A file attached to a message. The chip opens the file (its accessible
 * name says what the click does: "Preview report.pdf (12 KB)"); the save
 * and download actions are buttons at its end.
 */
export function AttachmentCard({
  name,
  size,
  thumbnail,
  openLabel,
  downloadLabel,
  onOpen,
  onDownload,
  onDragStart,
  save = null,
  'data-testid': testId
}: AttachmentCardProps): ReactElement {
  const [stem, extension] = splitName(name)
  return (
    <Box
      sx={save?.status === 'saved' ? SAVED_CHIP_SX : CHIP_SX}
      draggable={onDragStart !== undefined}
      onDragStart={onDragStart}
      data-testid={testId}
    >
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
      {save === null ? null : (
        <AttachmentSaveButton
          save={save}
          name={name}
          testId={testId ? `${testId}-save` : undefined}
        />
      )}
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

/**
 * The button keeps the focus while it saves (`aria-disabled`, not
 * `disabled`, which would drop it), and its name says the status
 */
function AttachmentSaveButton({
  save,
  name,
  testId
}: {
  save: AttachmentSave
  name: string
  testId: string | undefined
}): ReactElement {
  const { status, labels, onSave, onOpen } = save
  if (status === 'saved' && onOpen === undefined) {
    return (
      <Tooltip title={labels.saved}>
        <Box
          component="span"
          role="status"
          aria-label={`${labels.saved} ${name}`}
          sx={SAVED_STATUS_SX}
          data-status={status}
          data-testid={testId}
        >
          <Icon icon={CheckCircle} size={18} aria-hidden="true" />
        </Box>
      </Tooltip>
    )
  }
  const label = status === 'saved' ? labels.open : labels[status]
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (status === 'idle') onSave(event)
    else if (status === 'saved') onOpen?.(event)
  }
  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={`${label} ${name}`}
        aria-disabled={status === 'saving' ? true : undefined}
        onClick={handleClick}
        sx={SAVE_SX}
        className={status === 'saved' ? 'AttachmentCard-saved' : undefined}
        data-status={status}
        data-testid={testId}
      >
        {status === 'saving' ? (
          <CircularProgress size={18} aria-hidden="true" />
        ) : (
          <Icon
            icon={status === 'saved' ? CheckCircle : AddToCloud}
            aria-hidden="true"
          />
        )}
      </IconButton>
    </Tooltip>
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
        sx={{ color: 'text.icon' }}
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
          typography: 'body1',
          color: 'text.secondary'
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
  /** The cloud for "Save all to Drive"; the download arrow by default */
  icon?: 'download' | 'save'
  /** While it runs: the button is announced busy and does nothing */
  isBusy?: boolean
  'data-testid'?: string
}

/** "Download all", "Save all to Drive": grey text, the icon after it */
export function AttachmentDownloadAll({
  label,
  onClick,
  icon = 'download',
  isBusy = false,
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
      onClick={isBusy ? undefined : onClick}
      aria-disabled={isBusy ? true : undefined}
      aria-busy={isBusy ? true : undefined}
      data-testid={testId}
    >
      {label}
      <span className="AttachmentCard-icon" aria-hidden="true">
        {isBusy ? (
          <CircularProgress size={16} />
        ) : (
          <Icon icon={icon === 'save' ? AddToCloud : Download} size={16} />
        )}
      </span>
    </ButtonBase>
  )
}
