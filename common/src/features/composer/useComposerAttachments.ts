import { useEffect, useRef, useState } from 'react'

import { useAuthService } from '@common/features/auth/AuthProvider'
import { useAlert } from '@common/features/confirm/ConfirmProvider'
import { cleanFileName } from '@common/features/email/cleanFileName'
import { formatSize } from '@common/features/email/formatSize'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import type { AttachedFile } from './composeEmail'
import type { ComposerAttachment } from './composerContent'
import { fileCharset } from './textCharset'
import { uploadBlob, uploadUrlFor } from './uploadBlob'

/** The size limits of the server, null when it gives none */
export interface UploadLimits {
  /** Largest file (`maxSizeUpload` of the core capability) */
  maxFileSize: number | null
  /** Largest total of the files of a message (`maxSizeAttachmentsPerEmail`) */
  maxTotalSize: number | null
}

function readNumber(object: unknown, key: string): number | null {
  if (typeof object !== 'object' || object === null || !(key in object)) {
    return null
  }
  const value: unknown = Object.entries(object).find(
    ([name]) => name === key
  )?.[1]
  return typeof value === 'number' && value > 0 ? value : null
}

export function useUploadLimits(): UploadLimits {
  const { session, accountId } = useJmapSession()
  return {
    maxFileSize: readNumber(
      session.capabilities['urn:ietf:params:jmap:core'],
      'maxSizeUpload'
    ),
    maxTotalSize: readNumber(
      session.accounts[accountId]?.accountCapabilities[
        'urn:ietf:params:jmap:mail'
      ],
      'maxSizeAttachmentsPerEmail'
    )
  }
}

export interface ComposerAttachments {
  attachments: ComposerAttachment[]
  /**
   * Whether files of these sizes fit in the limits, with the files and the
   * inline images already there; says why when they do not
   */
  fits: (sizes: number[]) => boolean
  /** Checks the limits, then uploads the files */
  addFiles: (files: File[]) => void
  /**
   * Checks the limits, then attaches a file already on the server (one of
   * another message, dragged here): nothing to upload
   */
  addUploaded: (file: AttachedFile) => void
  /** Removes a file, cancelling its upload */
  remove: (id: string) => void
  /** Uploads again a file whose upload failed */
  retry: (id: string) => void
  /** Local `blob:` URL of the picture files added in this session */
  previews: Readonly<Record<string, string>>
  /** Said by the live region of the list */
  status: string
  isUploading: boolean
  /**
   * After a save: the files now live in the parts of the saved version
   * (the old ones go with the previous version), in the order they were
   * sent
   */
  rebase: (
    parts: { blobId: string | null; disposition: string | null }[]
  ) => void
}

/**
 * The files attached to a message: uploaded as soon as they are added
 * (with their progress, cancelled when removed), within the size limits of
 * the server, counting the inline images (`otherSize`).
 */
export function useComposerAttachments(
  initial: ComposerAttachment[],
  otherSize: () => number,
  onChange: () => void
): ComposerAttachments {
  const { t, lang } = useI18n()
  const alert = useAlert()
  const authService = useAuthService()
  const { session, accountId } = useJmapSession()
  const limits = useUploadLimits()
  const [attachments, setAttachments] = useState(initial)
  const [status, setStatus] = useState('')
  const controllers = useRef(new Map<string, AbortController>())
  /** The files of this session, kept to upload them again */
  const sources = useRef(new Map<string, File>())
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const previewUrls = useRef(new Map<string, string>())
  const attachmentsRef = useRef(attachments)
  useEffect(() => {
    attachmentsRef.current = attachments
  })

  useEffect(() => {
    const running = controllers.current
    const urls = previewUrls.current
    return () => {
      running.forEach(controller => {
        controller.abort()
      })
      urls.forEach(url => {
        URL.revokeObjectURL(url)
      })
    }
  }, [])

  const update = (id: string, patch: Partial<ComposerAttachment>): void => {
    setAttachments(current =>
      current.map(item => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const run = (id: string, file: File): void => {
    const type = file.type || 'application/octet-stream'
    const shownName = cleanFileName(file.name) ?? t('email.attachment')
    const controller = new AbortController()
    controllers.current.set(id, controller)
    Promise.all([
      uploadBlob({
        url: uploadUrlFor(session.uploadUrl, accountId),
        blob: file,
        type,
        auth: authService,
        signal: controller.signal,
        onProgress: (loaded, total) => {
          update(id, {
            progress: total > 0 ? Math.round((loaded / total) * 100) : 0
          })
        }
      }),
      fileCharset(file, type)
    ])
      .then(([uploaded, charset]) => {
        update(id, {
          blobId: uploaded.blobId,
          size: uploaded.size,
          charset,
          status: 'done',
          progress: 100
        })
        setStatus(t('composer.attachments.uploaded', { name: shownName }))
        onChange()
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error(error)
        update(id, { status: 'failed', progress: 0 })
        setStatus(t('composer.attachments.uploadFailed', { name: shownName }))
      })
      .finally(() => {
        controllers.current.delete(id)
      })
  }

  const upload = (file: File): void => {
    const id = crypto.randomUUID()
    const type = file.type || 'application/octet-stream'
    sources.current.set(id, file)
    if (
      type.startsWith('image/') &&
      typeof URL.createObjectURL === 'function'
    ) {
      const url = URL.createObjectURL(file)
      previewUrls.current.set(id, url)
      setPreviews(current => ({ ...current, [id]: url }))
    }
    setAttachments(current => [
      ...current,
      {
        id,
        blobId: '',
        type,
        name: file.name,
        size: file.size,
        status: 'uploading',
        progress: 0
      }
    ])
    run(id, file)
  }

  const retry = (id: string): void => {
    const file = sources.current.get(id)
    if (!file || controllers.current.has(id)) return
    update(id, { status: 'uploading', progress: 0 })
    run(id, file)
  }

  const refuse = (maxSize: number): void => {
    void alert({
      title: t('composer.attachments.tooLargeTitle'),
      message: t('composer.attachments.tooLarge', {
        maxSize: formatSize(maxSize, lang)
      }),
      confirmLabel: t('composer.gotIt')
    })
  }

  const fits = (sizes: number[]): boolean => {
    const { maxFileSize, maxTotalSize } = limits
    if (maxFileSize !== null && sizes.some(size => size > maxFileSize)) {
      refuse(maxFileSize)
      return false
    }
    const current = attachmentsRef.current
      .filter(item => item.status !== 'failed')
      .reduce((total, item) => total + item.size, 0)
    const added = sizes.reduce((total, size) => total + size, 0)
    if (maxTotalSize !== null && current + otherSize() + added > maxTotalSize) {
      refuse(maxTotalSize)
      return false
    }
    return true
  }

  const addFiles = (files: File[]): void => {
    if (fits(files.map(file => file.size))) files.forEach(upload)
  }

  const addUploaded = (file: AttachedFile): void => {
    if (!fits([file.size])) return
    setAttachments(current => [
      ...current,
      { ...file, id: crypto.randomUUID(), status: 'done', progress: 100 }
    ])
    setStatus(
      t('composer.attachments.uploaded', {
        name: cleanFileName(file.name) ?? t('email.attachment')
      })
    )
    onChange()
  }

  const remove = (id: string): void => {
    controllers.current.get(id)?.abort()
    controllers.current.delete(id)
    sources.current.delete(id)
    const url = previewUrls.current.get(id)
    if (url !== undefined) {
      URL.revokeObjectURL(url)
      previewUrls.current.delete(id)
      setPreviews(current =>
        Object.fromEntries(
          Object.entries(current).filter(([key]) => key !== id)
        )
      )
    }
    const removed = attachmentsRef.current.find(item => item.id === id)
    setAttachments(current => current.filter(item => item.id !== id))
    if (removed) {
      setStatus(t('composer.attachments.removed', { name: removed.name }))
      if (removed.status === 'done') onChange()
    }
  }

  const rebase = (
    parts: { blobId: string | null; disposition: string | null }[]
  ): void => {
    const blobIds = parts
      .filter(part => part.disposition !== 'inline' && part.blobId !== null)
      .map(part => part.blobId ?? '')
    setAttachments(current => {
      let index = 0
      return current.map(item => {
        if (item.status !== 'done') return item
        const blobId = blobIds[index]
        index += 1
        return blobId === undefined ? item : { ...item, blobId }
      })
    })
  }

  return {
    attachments,
    fits,
    addFiles,
    addUploaded,
    remove,
    retry,
    previews,
    rebase,
    status,
    isUploading: attachments.some(item => item.status === 'uploading')
  }
}
