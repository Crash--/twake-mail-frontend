import type { Sdk } from '@linagora/twake-sdk'
import { queryOptions } from '@tanstack/react-query'

import type { QueryOptionsFor } from '@common/app/queryOptionsTypes'

import { lookupSavedFiles } from './saveToDrive'

/** The doctype Drive references a saved attachment from */
export const MAIL_ATTACHMENT_DOCTYPE = 'io.cozy.mails.attachments'

export interface AttachmentReference {
  type: typeof MAIL_ATTACHMENT_DOCTYPE
  id: string
}

/** One reference per attachment, the same in every client of the account */
export function makeAttachmentReference(
  accountId: string,
  emailId: string,
  blobId: string
): AttachmentReference {
  return {
    type: MAIL_ATTACHMENT_DOCTYPE,
    id: `${accountId}:${emailId}:${blobId}`
  }
}

export const driveKeys = {
  savedAttachments: (accountId: string, emailId: string) =>
    ['drive', accountId, 'savedAttachments', emailId] as const
}

type SavedAttachmentsKey = ReturnType<typeof driveKeys.savedAttachments>

/** The id of the file of Drive each attachment was saved to, by blob */
export type SavedAttachments = Readonly<Record<string, string>>

/**
 * The attachments of an email saved to Drive, asked to Drive through the
 * LOOKUP intent in a hidden frame of `element`: an attachment whose file is
 * gone or in the trash is not saved. Fails when Drive does not tell.
 */
export function savedAttachmentsQueryOptions(
  sdk: Sdk | null,
  element: HTMLElement | null,
  frameTitle: string,
  accountId: string,
  emailId: string,
  blobIds: readonly string[]
): QueryOptionsFor<SavedAttachments, SavedAttachmentsKey> {
  // The client and the frame only carry the request, the title only names
  // the frame, and the attachments of an email are those of its id
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryKey: driveKeys.savedAttachments(accountId, emailId),
    queryFn: async ({ signal }) => {
      if (sdk === null || element === null) return {}
      const references = blobIds.map(blobId =>
        makeAttachmentReference(accountId, emailId, blobId)
      )
      const files = await lookupSavedFiles(
        sdk,
        references,
        element,
        frameTitle,
        signal
      )
      if (files === null) throw new Error('Drive did not tell the saved files')
      return Object.fromEntries(
        references.flatMap(({ id }, index): [string, string][] => {
          const fileId = files.get(id)
          const blobId = blobIds[index]
          return fileId !== undefined && blobId !== undefined
            ? [[blobId, fileId]]
            : []
        })
      )
    },
    staleTime: 60_000,
    // Each try loads Drive in a frame: "Save to my Drive" shows meanwhile
    retry: false
  })
}
