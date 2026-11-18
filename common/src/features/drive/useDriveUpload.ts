import type { Sdk } from '@linagora/twake-sdk'
import { Intents } from 'cozy-interapp'
import { useCallback, useEffect, useRef, useState } from 'react'

import { readPickedFiles, type DriveFile } from './driveIntent'
import { DRIVE_READY_TIMEOUT_MS } from './useDrivePicker'

/**
 * The Mail folder of Drive, which tmail-flutter fills too: the stack makes
 * it when it is missing, and finds it again once renamed or moved
 */
export const MAIL_FOLDER_ID = 'io.cozy.apps/mail'

/**
 * Time a ready Drive frame may stay silent (no progress, no end) before its
 * file fails: Drive reports progress while it uploads
 */
export const DRIVE_UPLOAD_IDLE_MS = 60_000

export interface DriveUploadFile {
  id: string
  file: File
  status: 'uploading' | 'done' | 'failed'
  /** 0 to 100 */
  progress: number
}

export interface DriveUploadEnd {
  /** The files Drive stored, with their public link, in the order picked */
  links: DriveFile[]
  failedCount: number
}

export interface DriveUpload {
  /** The files of the batch under way, none otherwise */
  files: DriveUploadFile[]
  /** Gets the box the (hidden) frames of Drive go in */
  setFrameContainer: (element: HTMLElement | null) => void
  /** Sends the files to Drive; false when it cannot (no Drive, a batch under way) */
  start: (files: File[]) => boolean
  /** Stops one file; the stored part of it may stay in Drive */
  cancel: (id: string) => void
  cancelAll: () => void
}

type Outcome =
  | { status: 'done'; link: DriveFile }
  | { status: 'failed' }
  | { status: 'cancelled' }

function readProgress(result: unknown): number | null {
  if (typeof result !== 'object' || result === null) return null
  if (!('loaded' in result) || !('total' in result)) return null
  const { loaded, total } = result
  if (typeof loaded !== 'number' || typeof total !== 'number' || total <= 0) {
    return null
  }
  return Math.min(100, Math.round((loaded / total) * 100))
}

/**
 * One file through the UPLOAD intent of Drive (linagora/twake-drive#4624):
 * stored in the Mail folder, with a read-only public link
 */
async function sendToDrive(
  sdk: Sdk,
  file: File,
  element: HTMLElement,
  frameTitle: string,
  onProgress: (progress: number) => void,
  onStop: (stop: () => void) => void
): Promise<Outcome> {
  let isStopped = false
  let stopIntent: (() => void) | null = null
  const stopped = new Promise<Outcome>(resolve => {
    onStop(() => {
      isStopped = true
      stopIntent?.()
      resolve({ status: 'cancelled' })
    })
  })
  // Once Drive is ready, nothing else ends a frame that goes silent
  const timer: { idle: number | null } = { idle: null }
  let armIdle = (): void => undefined
  const idle = new Promise<Outcome>(resolve => {
    armIdle = () => {
      if (timer.idle !== null) window.clearTimeout(timer.idle)
      timer.idle = window.setTimeout(() => {
        stopIntent?.()
        resolve({ status: 'failed' })
      }, DRIVE_UPLOAD_IDLE_MS)
    }
  })
  const sent = async (): Promise<Outcome> => {
    const intent = new Intents({ client: sdk }).create(
      'UPLOAD',
      'io.cozy.files',
      {
        folderId: MAIL_FOLDER_ID,
        files: [file],
        sharingLink: true,
        progress: true
      }
    )
    await intent
    if (isStopped) return { status: 'cancelled' }
    const started = intent.start(element, {
      title: frameTitle,
      focus: false,
      readyTimeout: DRIVE_READY_TIMEOUT_MS,
      onServiceReady: armIdle,
      onResult: result => {
        armIdle()
        const progress = readProgress(result)
        if (progress !== null) onProgress(progress)
      }
    })
    stopIntent = () => {
      started.stop()
    }
    // A Drive without the `sharingLink` option stores the file, links none
    const [link] = readPickedFiles(await started)
    if (link === undefined) return { status: 'failed' }
    return link.sharingLink === null
      ? { status: 'failed' }
      : { status: 'done', link }
  }
  try {
    return await Promise.race([
      sent().catch((error: unknown): Outcome => {
        console.warn('[drive] A file could not be uploaded', error)
        return { status: 'failed' }
      }),
      // A stopped intent never settles
      stopped,
      idle
    ])
  } finally {
    if (timer.idle !== null) window.clearTimeout(timer.idle)
  }
}

/**
 * Files too large for the mail server, sent to Twake Drive one after the
 * other, each in a hidden frame of the UPLOAD intent, with its progress.
 * `onEnd` gets their links once every file is stored, failed or cancelled.
 * Unmounting stops them.
 */
export function useDriveUpload(
  sdk: Sdk | null,
  /** Title of the frames, for screen readers */
  frameTitle: string,
  onEnd: (end: DriveUploadEnd) => void
): DriveUpload {
  const [files, setFiles] = useState<DriveUploadFile[]>([])
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const batchRef = useRef<DriveUploadFile[]>([])
  const stopsRef = useRef(new Map<string, () => void>())
  const cancelledRef = useRef(new Set<string>())
  const isRunningRef = useRef(false)
  const isUnmountedRef = useRef(false)
  const frameTitleRef = useRef(frameTitle)
  const onEndRef = useRef(onEnd)
  useEffect(() => {
    frameTitleRef.current = frameTitle
    onEndRef.current = onEnd
  })

  const update = (id: string, patch: Partial<DriveUploadFile>): void => {
    setFiles(current =>
      current.map(item => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const cancel = useCallback((id: string): void => {
    cancelledRef.current.add(id)
    stopsRef.current.get(id)?.()
    setFiles(current => current.filter(item => item.id !== id))
  }, [])

  const cancelAll = useCallback((): void => {
    batchRef.current.forEach(item => {
      cancel(item.id)
    })
    // Over: only the failed files were left, the dialog closes
    if (!isRunningRef.current) batchRef.current = []
  }, [cancel])

  const start = useCallback(
    (picked: File[]): boolean => {
      if (sdk === null || container === null || batchRef.current.length > 0) {
        return false
      }
      const batch = picked.map((file): DriveUploadFile => ({
        id: crypto.randomUUID(),
        file,
        status: 'uploading',
        progress: 0
      }))
      batchRef.current = batch
      cancelledRef.current.clear()
      isRunningRef.current = true
      setFiles(batch)
      const run = async (): Promise<void> => {
        const links: DriveFile[] = []
        const failed: DriveUploadFile[] = []
        for (const item of batch) {
          if (isUnmountedRef.current) return
          if (cancelledRef.current.has(item.id)) continue
          const outcome = await sendToDrive(
            sdk,
            item.file,
            container,
            frameTitleRef.current,
            progress => {
              update(item.id, { progress })
            },
            stop => {
              stopsRef.current.set(item.id, stop)
            }
          )
          stopsRef.current.delete(item.id)
          if (outcome.status === 'done') {
            links.push(outcome.link)
            update(item.id, { status: 'done', progress: 100 })
          } else if (outcome.status === 'failed') {
            failed.push(item)
            update(item.id, { status: 'failed' })
          }
        }
        if (isUnmountedRef.current) return
        isRunningRef.current = false
        // The failed files stay shown until the user closes the dialog
        const left = failed.filter(item => !cancelledRef.current.has(item.id))
        batchRef.current = left
        setFiles(current =>
          current.filter(item => left.some(failure => failure.id === item.id))
        )
        onEndRef.current({ links, failedCount: failed.length })
      }
      run().catch((error: unknown) => {
        console.warn('[drive] The upload stopped', error)
      })
      return true
    },
    [sdk, container]
  )

  // Unmounted: the file under way stops, the next ones are not sent
  useEffect(() => {
    const stops = stopsRef.current
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
      stops.forEach(stop => {
        stop()
      })
    }
  }, [])

  return { files, setFrameContainer: setContainer, start, cancel, cancelAll }
}
