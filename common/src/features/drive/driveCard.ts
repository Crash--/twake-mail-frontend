import type { DriveFile } from './driveIntent'

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * The card of a Drive file shared by link, as tmail-flutter writes it
 * (`FileLinkCardHtmlBuilder`, class `tmail-file-link-card`), so that both
 * apps recognize it; plain HTML with inline styles for any mail client.
 */
export function driveCardHtml(
  file: Pick<DriveFile, 'name' | 'sharingLink' | 'thumbnail'>,
  actionLabel: string
): string {
  const href = escapeHtml(file.sharingLink ?? '')
  const title = escapeHtml(file.name)
  const icon = file.thumbnail
    ? `<img src="${escapeHtml(file.thumbnail)}" alt="" width="60" height="60" style="display:inline-block;vertical-align:middle;" />`
    : ''
  return (
    `<a href="${href}" target="_blank" rel="noopener noreferrer" contenteditable="false" tabindex="-1" class="tmail-file-link-card" style="display:inline-block;vertical-align:top;width:183px;min-height:151px;margin:0 8px 8px 0;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;background:#FFFFFF;color:inherit;text-decoration:none;">` +
    `<div style="height:94px;line-height:94px;text-align:center;background:#F5F6F8;border-bottom:1px solid #E5E7EB;">${icon}</div>` +
    `<div style="padding:10px 12px;">` +
    `<div style="font-size:14px;font-weight:500;color:#1F2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${title}">${title}</div>` +
    `<div style="display:block;margin-top:6px;font-size:12px;color:#0067D6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(actionLabel)} ↗</div>` +
    `</div></a>`
  )
}

/** The kind of the editor block holding the cards */
export const DRIVE_CARD_BLOCK = 'drive-card'

/** The cards of the files shared by link, in a block of the editor */
export function driveCardsBlock(
  files: readonly Pick<DriveFile, 'name' | 'sharingLink' | 'thumbnail'>[],
  actionLabel: string
): string {
  return `<div style="display:block;max-width:100%;">${files
    .map(file => driveCardHtml(file, actionLabel))
    .join('')}</div>`
}

/** The message shares Twake Drive files by link (cards of either app) */
export function hasDriveCards(html: string): boolean {
  return /class="[^"]*\btmail-file-link-card\b/.test(html)
}
