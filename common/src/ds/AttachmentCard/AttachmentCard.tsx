// Upstream to twake-ui: yes, as an attachment tile (file type thumbnail,
// truncated name, size, actions shown on hover or focus), shared by Mail,
// Chat and Drive; and its "+N more" companion. Meanwhile local, on twake-mui
// `ButtonBase`, `IconButton` and `Tooltip`.
import { Download, Icon, Attachment } from '@linagora/twake-icons'
import {
  Box,
  ButtonBase,
  IconButton,
  Tooltip,
  Typography
} from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export const ATTACHMENT_CARD_WIDTH = 160

const CARD_SX = {
  position: 'relative',
  width: ATTACHMENT_CARD_WIDTH,
  maxWidth: '100%',
  height: 120,
  border: 1,
  borderColor: 'divider',
  borderRadius: 1,
  overflow: 'hidden',
  bgcolor: 'background.paper',
  '&:hover, &:focus-within': { bgcolor: 'action.hover' },
  '&:hover .attachment-card-actions, &:focus-within .attachment-card-actions': {
    opacity: 1
  }
} as const

const MAIN_SX = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  width: '100%',
  height: '100%',
  textAlign: 'start'
} as const

const THUMBNAIL_SX = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  bgcolor: 'action.hover',
  '& svg': { width: 40, height: 40 }
} as const

const ACTIONS_SX = {
  position: 'absolute',
  insetInlineEnd: 4,
  bottom: 4,
  display: 'flex',
  opacity: 0,
  '@media (hover: none)': { opacity: 1 }
} as const

export interface AttachmentCardProps {
  name: string
  /** Formatted size, e.g. "12 KB" */
  size: string
  /** The file type icon, drawn in the thumbnail area */
  thumbnail: ReactNode
  /** Accessible name prefix of the card, e.g. "Preview" or "Download" */
  openLabel: string
  /** Accessible name and tooltip of the download action, e.g. "Download" */
  downloadLabel: string
  onOpen: () => void
  onDownload: () => void
  'data-testid'?: string
}

/**
 * A file attached to a message. The card opens the file (its accessible
 * name says what the click does: "Preview report.pdf (12 KB)"); the download
 * action is a second button, shown on hover and focus but always in the DOM,
 * so the keyboard reaches it.
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
  return (
    <Box sx={CARD_SX} data-testid={testId}>
      <ButtonBase
        sx={MAIN_SX}
        onClick={onOpen}
        title={name}
        aria-label={`${openLabel} ${name} (${size})`}
        data-testid={testId ? `${testId}-open` : undefined}
      >
        <Box sx={THUMBNAIL_SX} aria-hidden="true">
          {thumbnail}
        </Box>
        <Box sx={{ px: 1, py: 0.5, minWidth: 0 }}>
          <Typography variant="body2" noWrap aria-hidden="true">
            {name}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            aria-hidden="true"
          >
            {size}
          </Typography>
        </Box>
      </ButtonBase>
      <Box className="attachment-card-actions" sx={ACTIONS_SX}>
        <Tooltip title={downloadLabel}>
          <IconButton
            size="small"
            aria-label={`${downloadLabel} ${name}`}
            onClick={onDownload}
            data-testid={testId ? `${testId}-download` : undefined}
          >
            <Icon icon={Download} aria-hidden="true" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}

export interface AttachmentMoreCardProps {
  /** E.g. "+5 more" */
  label: string
  onClick: () => void
  'data-testid'?: string
}

/** The tile that reveals the attachments the row has no room for */
export function AttachmentMoreCard({
  label,
  onClick,
  'data-testid': testId
}: AttachmentMoreCardProps): ReactElement {
  return (
    <Box sx={CARD_SX}>
      <ButtonBase
        sx={{ ...MAIN_SX, alignItems: 'center', justifyContent: 'center' }}
        onClick={onClick}
        data-testid={testId}
      >
        <Icon icon={Attachment} aria-hidden="true" />
        <Typography variant="body2" className="u-mt-half">
          {label}
        </Typography>
      </ButtonBase>
    </Box>
  )
}

/** The cards of an email, wrapping, with room between them */
export function AttachmentCardRow({
  children,
  'data-testid': testId
}: {
  children: ReactNode
  'data-testid'?: string
}): ReactElement {
  return (
    <Box
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
      data-testid={testId}
    >
      {children}
    </Box>
  )
}
