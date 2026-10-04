// Upstream to twake-ui: yes, as an attachment tile (file type icon, name,
// size, download and preview actions), shared by Mail, Chat and Drive.
// Meanwhile a twake-mui `Chip`.
import { Attachment, Download, Icon } from '@linagora/twake-icons'
import { Chip } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

export interface AttachmentChipProps {
  name: string
  /** Formatted size, e.g. "12 KB" */
  size: string
  /** Accessible name prefix of the download action, e.g. "Download" */
  downloadLabel: string
  onDownload: () => void
  'data-testid'?: string
}

/**
 * A file attached to a message: name and size, downloaded on click. Its
 * accessible name says what the click does ("Download report.pdf").
 */
export function AttachmentChip({
  name,
  size,
  downloadLabel,
  onDownload,
  'data-testid': testId
}: AttachmentChipProps): ReactElement {
  const label = `${downloadLabel} ${name}`
  return (
    <Chip
      className="u-mr-half u-mb-half"
      variant="outlined"
      icon={<Icon icon={Attachment} aria-hidden="true" />}
      endIcon={<Icon icon={Download} aria-hidden="true" />}
      label={`${name} (${size})`}
      title={label}
      aria-label={`${label} (${size})`}
      onClick={onDownload}
      data-testid={testId}
    />
  )
}
