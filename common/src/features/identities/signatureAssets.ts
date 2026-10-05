import type { JmapClient } from 'jmap-client-ts'

/**
 * PublicAssets of signature images (`com:linagora:params:jmap:public:assets`),
 * as tmail-flutter manages them: an image inserted in the editor is
 * uploaded and published at once; once the identity is saved, the images
 * removed from the signature are released, the new ones tied to it.
 */

export interface PublishedImage {
  assetId: string
  publicUri: string
}

/** Uploads an image and publishes it, tied to the identity when it exists */
export async function publishSignatureImage(
  client: JmapClient,
  accountId: string,
  file: Blob,
  identityId: string | null
): Promise<PublishedImage | null> {
  const { blobId } = await client.upload(accountId, file)
  const response = await client.call('PublicAsset/set', {
    accountId,
    create: {
      image: {
        blobId,
        identityIds: identityId === null ? {} : { [identityId]: true }
      }
    }
  })
  const created = response.created?.image
  if (!created?.publicURI) return null
  return { assetId: created.id, publicUri: created.publicURI }
}

export interface SignatureAssetChanges {
  /** Published while editing, not in the saved signature: destroyed */
  destroy: readonly string[]
  /** In the signature before, not anymore: released from the identity */
  release: readonly string[]
  /** In the saved signature, not tied to the identity yet */
  tie: readonly string[]
}

/** What the saved signature changes to the PublicAssets of the identity */
export function signatureAssetChanges({
  before,
  published,
  saved,
  isNewIdentity
}: {
  /** Asset ids of the signature when the editor opened */
  before: readonly string[]
  /** Asset ids published while editing */
  published: readonly string[]
  /** Asset ids of the saved signature */
  saved: readonly string[]
  /** Images published before the identity existed are not tied to it yet */
  isNewIdentity: boolean
}): SignatureAssetChanges {
  return {
    destroy: published.filter(id => !saved.includes(id)),
    release: before.filter(id => !saved.includes(id)),
    tie: saved.filter(
      id => !before.includes(id) && (isNewIdentity || !published.includes(id))
    )
  }
}

/** Applies the changes; failures only leave unused images on the server */
export async function applySignatureAssetChanges(
  client: JmapClient,
  accountId: string,
  identityId: string,
  changes: SignatureAssetChanges
): Promise<void> {
  const update: Record<string, Record<string, true | null>> = {}
  for (const id of changes.release) {
    update[id] = { [`identityIds/${identityId}`]: null }
  }
  for (const id of changes.tie) {
    update[id] = { [`identityIds/${identityId}`]: true }
  }
  if (changes.destroy.length === 0 && Object.keys(update).length === 0) return
  await client.call('PublicAsset/set', {
    accountId,
    update: Object.keys(update).length === 0 ? null : update,
    destroy: changes.destroy.length === 0 ? null : changes.destroy
  })
}

/** Destroys images published in an editor closed without saving */
export async function discardSignatureImages(
  client: JmapClient,
  accountId: string,
  assetIds: readonly string[]
): Promise<void> {
  if (assetIds.length === 0) return
  await client.call('PublicAsset/set', { accountId, destroy: assetIds })
}
