// Upstream to twake-ui: yes. A list of files being sent (attachments of a
// message, files of a chat or a Drive upload): type icon or thumbnail, name,
// size, progress, retry, remove, and a "show more / less" fold. twake-mui
// has neither the list nor the item.
import {
  Icon,
  Bottom,
  CheckCircle,
  Cross,
  Refresh,
  Top,
  Warning
} from '@linagora/twake-icons'
import {
  Box,
  Button,
  ButtonBase,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import { useState, type ReactElement, type ReactNode } from 'react'

export type UploadStatus = 'uploading' | 'done' | 'failed'

export interface UploadListItem {
  id: string
  name: string
  /** Formatted size, e.g. "12 KB" */
  size: string
  status: UploadStatus
  /** 0 to 100, while uploading */
  progress: number
  /** The file type icon (20 px), when there is no thumbnail */
  icon: ReactNode
  /** A small picture of the file (an image), replacing the icon */
  thumbnailUrl?: string
  /**
   * What a click on an uploaded file does, e.g. "Preview" or "Download":
   * the file can be opened when the list has `onOpen` and the item a label
   */
  openLabel?: string
}

export interface UploadListLabels {
  /** Name of the list, e.g. "Attachments (2)" */
  list: string
  /** Name of the button removing a file (or cancelling its upload) */
  remove: (name: string) => string
  /** Name of the button uploading a failed file again */
  retry: (name: string) => string
  /** Name of the progress bar of a file */
  progress: (name: string) => string
  /** Said of a file whose upload failed */
  failed: string
  /** Said of a file that was uploaded (an icon shows it) */
  done: string
  showLess: string
  showMore: (hidden: number) => string
}

export interface UploadTestIds {
  list?: string
  item?: string
  open?: string
  remove?: string
  retry?: string
  toggle?: string
}

export interface UploadListProps {
  items: readonly UploadListItem[]
  labels: UploadListLabels
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  /** Opens (previews or downloads) an uploaded file */
  onOpen?: (id: string) => void
  /**
   * Files shown while the list is folded. The fold is offered only when
   * every file is uploaded and there are more than this (tmail-flutter);
   * null never folds
   */
  foldedCount?: number | null
  /** Announced politely (e.g. "report.pdf uploaded") */
  status?: string
  testIds?: UploadTestIds
}

export const UPLOAD_CHIP_WIDTH = 280
const TAIL_LENGTH = 6

/**
 * A 20 px button in a chip. The theme gives buttons 44 px on touch screens:
 * the negative margin keeps the chip at its height while the target stays 44
 */
const SMALL_BUTTON_SX = {
  width: 20,
  height: 20,
  minWidth: 20,
  p: 0,
  flexShrink: 0,
  '@media (pointer: coarse), (max-width: 599.95px)': {
    width: 44,
    height: 44,
    minWidth: 44,
    m: '-12px'
  }
} as const

const NAME_SX = {
  display: 'flex',
  minWidth: 0,
  flex: 1,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  letterSpacing: '0.1px',
  color: 'text.primary'
} as const

/** The open button lays out its icon, name and size as the chip does */
const OPEN_SX = {
  gap: '8px',
  minWidth: 0,
  justifyContent: 'flex-start',
  textAlign: 'start',
  borderRadius: '4px'
} as const

const SIZE_SX = { flexShrink: 0, color: 'text.secondary' } as const

/** The name cut in the middle ("Super Thur…pptx"): its end is kept */
function MiddleEllipsis({ name }: { name: string }): ReactElement {
  const tail = name.length > TAIL_LENGTH * 2 ? name.slice(-TAIL_LENGTH) : ''
  const head = tail === '' ? name : name.slice(0, -TAIL_LENGTH)
  return (
    // The whole name in the tooltip of the app (not the browser's)
    <Tooltip title={name}>
      <Typography component="span" sx={NAME_SX}>
        <Box
          component="span"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {head}
        </Box>
        {tail === '' ? null : (
          <Box component="span" sx={{ flexShrink: 0, whiteSpace: 'pre' }}>
            {tail}
          </Box>
        )}
      </Typography>
    </Tooltip>
  )
}

export interface UploadChipProps {
  item: UploadListItem
  labels: Pick<
    UploadListLabels,
    'remove' | 'retry' | 'progress' | 'failed' | 'done'
  >
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onOpen?: (id: string) => void
  testIds?: UploadTestIds
}

/**
 * One file: icon, name, size, progress bar, retry and remove buttons. Once
 * uploaded, its icon, name and size may be a button opening it
 */
export function UploadChip({
  item,
  labels,
  onRemove,
  onRetry,
  onOpen,
  testIds = {}
}: UploadChipProps): ReactElement {
  const isFailed = item.status === 'failed'
  const isUploading = item.status === 'uploading'
  const summary = (
    <>
      {item.thumbnailUrl === undefined ? (
        <Box
          className="u-flex u-flex-shrink-0"
          sx={{
            color: isFailed ? 'error.main' : undefined,
            '& svg': { width: 20, height: 20 }
          }}
          aria-hidden="true"
        >
          {isFailed ? (
            <Icon icon={Warning} size={20} color="currentColor" />
          ) : (
            item.icon
          )}
        </Box>
      ) : (
        <Box
          component="img"
          src={item.thumbnailUrl}
          alt=""
          sx={{
            width: 20,
            height: 20,
            flexShrink: 0,
            borderRadius: '2px',
            objectFit: 'cover'
          }}
        />
      )}
      <MiddleEllipsis name={item.name} />
      <Typography
        component="span"
        variant="overline"
        sx={{ ...SIZE_SX, color: isFailed ? 'error.main' : 'text.secondary' }}
      >
        {isFailed ? labels.failed : item.size}
      </Typography>
    </>
  )
  return (
    <Box
      component="li"
      className="u-flex u-flex-items-center"
      sx={{
        gap: '12px',
        p: '8px',
        boxSizing: 'border-box',
        maxWidth: '100%',
        width: UPLOAD_CHIP_WIDTH,
        flexShrink: 0,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: isFailed ? 'error.main' : 'divider',
        borderRadius: '8px'
      }}
      data-testid={testIds.item}
      data-status={item.status}
    >
      <Box
        className="u-flex u-flex-column u-flex-auto"
        sx={{ gap: '6px', minWidth: 0 }}
      >
        <Box className="u-flex u-flex-items-center" sx={{ gap: '8px' }}>
          {onOpen !== undefined &&
          item.openLabel !== undefined &&
          item.status === 'done' ? (
            <ButtonBase
              className="u-flex u-flex-items-center u-flex-auto"
              sx={OPEN_SX}
              aria-label={`${item.openLabel} ${item.name} (${item.size})`}
              onClick={() => {
                onOpen(item.id)
              }}
              data-testid={testIds.open}
            >
              {summary}
            </ButtonBase>
          ) : (
            summary
          )}
          {item.status === 'done' ? (
            <>
              <Box
                className="u-flex u-flex-shrink-0"
                sx={{ color: 'success.main' }}
                aria-hidden="true"
              >
                <Icon icon={CheckCircle} size={16} color="currentColor" />
              </Box>
              <span className="u-visuallyhidden">{labels.done}</span>
            </>
          ) : null}
        </Box>
        {/* As tmail-flutter: a bar while the file uploads, none once it
            is uploaded or failed */}
        {isUploading ? (
          <LinearProgress
            variant="determinate"
            value={item.progress}
            aria-label={labels.progress(item.name)}
            sx={{
              height: 2,
              borderRadius: '1px',
              '& .MuiLinearProgress-bar': {
                transition: 'transform 200ms linear',
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none'
                }
              }
            }}
          />
        ) : null}
      </Box>
      {isFailed ? (
        <Tooltip title={labels.retry(item.name)}>
          <IconButton
            aria-label={labels.retry(item.name)}
            onClick={() => {
              onRetry(item.id)
            }}
            sx={SMALL_BUTTON_SX}
            data-testid={testIds.retry}
          >
            <Icon icon={Refresh} size={16} aria-hidden="true" />
          </IconButton>
        </Tooltip>
      ) : null}
      <Tooltip title={labels.remove(item.name)}>
        <IconButton
          aria-label={labels.remove(item.name)}
          onClick={() => {
            onRemove(item.id)
          }}
          sx={SMALL_BUTTON_SX}
          data-testid={testIds.remove}
        >
          <Box
            component="span"
            className="u-flex u-flex-items-center u-flex-justify-center"
            sx={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: 'action.selected'
            }}
          >
            <Icon icon={Cross} size={12} aria-hidden="true" />
          </Box>
        </IconButton>
      </Tooltip>
    </Box>
  )
}

/**
 * The files of a message, as a named list that wraps: each says its name and
 * size, shows its progress (a named `progressbar` while it uploads), says
 * when it failed (an icon and the words, not a colour only) and offers a
 * retry, and has a button removing it or cancelling its upload. Once all
 * are uploaded and there are many, a link folds the list ("Show more (+N)").
 * Changes are announced through a live region.
 */
export function UploadList({
  items,
  labels,
  onRemove,
  onRetry,
  onOpen,
  foldedCount = null,
  status,
  testIds = {}
}: UploadListProps): ReactElement {
  const [isFolded, setIsFolded] = useState(false)
  const canFold =
    foldedCount !== null &&
    items.length > foldedCount &&
    items.every(item => item.status === 'done')
  const shown = canFold && isFolded ? items.slice(0, foldedCount) : items
  const toggleLabel =
    canFold && isFolded
      ? labels.showMore(items.length - shown.length)
      : labels.showLess

  return (
    <Box>
      {items.length > 0 ? (
        <Box
          component="ul"
          aria-label={labels.list}
          className="u-flex u-flex-wrap u-flex-items-center"
          sx={{
            listStyle: 'none',
            m: 0,
            p: '12px',
            gap: '12px',
            maxHeight: 190,
            overflowY: 'auto'
          }}
          data-testid={testIds.list}
        >
          {shown.map(item => (
            <UploadChip
              key={item.id}
              item={item}
              labels={labels}
              onRemove={onRemove}
              onRetry={onRetry}
              {...(onOpen === undefined ? {} : { onOpen })}
              testIds={testIds}
            />
          ))}
          {canFold ? (
            <Box component="li" sx={{ display: 'flex' }}>
              <Button
                variant="text"
                size="small"
                aria-expanded={!isFolded}
                onClick={() => {
                  setIsFolded(folded => !folded)
                }}
                endIcon={<Icon icon={isFolded ? Bottom : Top} size={16} />}
                data-testid={testIds.toggle}
              >
                {toggleLabel}
              </Button>
            </Box>
          ) : null}
        </Box>
      ) : null}
      {/* Always mounted: a live region only announces changes */}
      <Box role="status" className="u-visuallyhidden">
        {status}
      </Box>
    </Box>
  )
}
