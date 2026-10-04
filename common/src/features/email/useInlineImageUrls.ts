import type { EmailBodyPart } from 'jmap-client-ts'
import { useEffect, useMemo, useState } from 'react'

import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import { normalizeCid } from './sanitizeEmailHtml'

export interface InlineImages {
  /** Object URL of each downloaded image, by Content-ID */
  urls: ReadonlyMap<string, string>
  isLoading: boolean
}

interface InlineImagePart {
  cid: string
  blobId: string
  type: string
}

function toInlineImagePart(part: EmailBodyPart): InlineImagePart | null {
  if (!part.cid || !part.blobId || !part.type.startsWith('image/')) return null
  return { cid: normalizeCid(part.cid), blobId: part.blobId, type: part.type }
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
    () =>
      parts
        .map(toInlineImagePart)
        .filter(
          (part): part is InlineImagePart =>
            part !== null && referencedCids.has(part.cid)
        ),
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
      const results = await Promise.allSettled(
        images.map(async image => {
          const blob = await client.download(
            { accountId, blobId: image.blobId, type: image.type },
            { signal: controller.signal }
          )
          const url = URL.createObjectURL(blob)
          created.push(url)
          return [image.cid, url] as const
        })
      )
      if (controller.signal.aborted) return
      const urls = new Map(
        results.flatMap(result =>
          result.status === 'fulfilled' ? [result.value] : []
        )
      )
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
