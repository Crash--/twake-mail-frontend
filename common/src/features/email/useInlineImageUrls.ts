import type { EmailBodyPart, JmapClient } from 'jmap-client-ts'
import { useEffect, useMemo, useState } from 'react'

import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { normalizeCid } from './sanitizeEmailHtml'

export interface InlineImages {
  /** Object URL of each downloaded image, by Content-ID */
  urls: ReadonlyMap<string, string>
  isLoading: boolean
}

export interface InlineImagePart {
  cid: string
  blobId: string
  type: string
}

function toInlineImagePart(part: EmailBodyPart): InlineImagePart | null {
  if (!part.cid || !part.blobId || !part.type.startsWith('image/')) return null
  return { cid: normalizeCid(part.cid), blobId: part.blobId, type: part.type }
}

/**
 * Downloads inline images with the credentials of the session; the ones
 * that cannot be fetched are left out. `onUrl` sees each object URL created,
 * to revoke it later.
 */
export async function downloadInlineImages(
  client: JmapClient,
  accountId: string,
  images: readonly InlineImagePart[],
  signal: AbortSignal,
  onUrl: (url: string) => void
): Promise<ReadonlyMap<string, string>> {
  const results = await Promise.allSettled(
    images.map(async image => {
      const blob = await client.download(
        { accountId, blobId: image.blobId, type: image.type },
        { signal }
      )
      const url = URL.createObjectURL(blob)
      onUrl(url)
      return [image.cid, url] as const
    })
  )
  return new Map(
    results.flatMap(result =>
      result.status === 'fulfilled' ? [result.value] : []
    )
  )
}

/** The inline images of an email that its HTML references */
export function findInlineImageParts(
  parts: readonly EmailBodyPart[],
  referencedCids: ReadonlySet<string>
): InlineImagePart[] {
  return parts
    .map(toInlineImagePart)
    .filter(
      (part): part is InlineImagePart =>
        part !== null && referencedCids.has(part.cid)
    )
}

const NO_IMAGES: ReadonlyMap<string, string> = new Map()

/**
 * Downloads the inline images (`cid:`) an email body references, with the
 * credentials of the session, and gives them object URLs. The URLs are
 * revoked when the email changes or the view goes away.
 */
export function useInlineImageUrls(
  parts: readonly EmailBodyPart[],
  referencedCids: ReadonlySet<string>
): InlineImages {
  const client = useJmapClient()
  const { accountId } = useJmapSession()
  const images = useMemo(
    () => findInlineImageParts(parts, referencedCids),
    [parts, referencedCids]
  )
  const imagesKey = images.map(image => image.blobId).join(',')
  const [loaded, setLoaded] = useState<{
    key: string
    urls: ReadonlyMap<string, string>
  } | null>(null)

  useEffect(() => {
    if (images.length === 0) return
    const controller = new AbortController()
    const created: string[] = []

    const downloadAll = async (): Promise<void> => {
      const urls = await downloadInlineImages(
        client,
        accountId,
        images,
        controller.signal,
        url => {
          created.push(url)
        }
      )
      if (controller.signal.aborted) return
      setLoaded({ key: imagesKey, urls })
    }
    void downloadAll()

    return () => {
      controller.abort()
      created.forEach(url => {
        URL.revokeObjectURL(url)
      })
    }
    // imagesKey identifies the images: a new array of the same images must
    // not download them again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, accountId, imagesKey])

  if (images.length === 0) return { urls: NO_IMAGES, isLoading: false }
  if (loaded?.key !== imagesKey) return { urls: NO_IMAGES, isLoading: true }
  return { urls: loaded.urls, isLoading: false }
}
