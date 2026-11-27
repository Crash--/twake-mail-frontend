import { useColorScheme } from '@linagora/twake-mui'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useAppConfig } from '@common/config/AppConfigProvider'
import {
  fetchBlobDownloadUrl,
  getBlobAccessEndpoint
} from '@common/features/drive/blobDownloadUrl'
import {
  readMovedFiles,
  saveUrlToDrive,
  settleWithin,
  type SavedDriveFile
} from '@common/features/drive/saveToDrive'
import {
  DRIVE_READY_TIMEOUT_MS,
  useDriveIntentDialog,
  useDriveSdk,
  type DriveIntentDialog
} from '@common/features/drive/useDrivePicker'
import { useNotify } from '@common/features/notifications/NotificationsProvider'
import { useI18n } from '@common/i18n/useI18n'
import { useJmapClient } from '@common/jmap/JmapClientProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

/** An attachment to save: its blob, the name Drive gives it, its bytes */
export interface DriveSaveRequest {
  blobId: string
  name: string
  size: number
}

export type DriveSaveStatus = 'idle' | 'saving' | 'saved'

export interface SaveToDrive {
  /**
   * `SAVE_TO_DRIVE_ENABLED`, Drive is there and the mail server gives
   * download tokens
   */
  isAvailable: boolean
  statusOf: (blobId: string) => DriveSaveStatus
  /** Saves the files not saved yet, one after the other */
  save: (files: readonly DriveSaveRequest[]) => void
  /** Opens the saved file in Drive, in a new tab */
  openSaved: (blobId: string) => void
  /** Gets the hidden box the frames of the uploads go in */
  frameContainerRef: (element: HTMLElement | null) => void
  /** "Organize": the MOVE intent of Drive, in a dialog */
  move: DriveIntentDialog
  /** Opens "Organize" again, after Drive failed to open */
  retryOrganize: () => void
  /** Where the focus goes back once "Organize" is closed */
  restoreFocus: () => void
}

/**
 * "Save to my Drive" for the attachments of an email: a short-lived
 * download token from the mail server, then the UPLOAD intent of Drive
 * from that URL into the Mail folder, so the bytes go from server to
 * server. A toast tells it, with "Organize" opening the MOVE intent.
 * A saved file is not sent again. The statuses last as long as the view.
 */
export function useSaveToDrive(): SaveToDrive {
  const { t } = useI18n()
  const { notify } = useNotify()
  const client = useJmapClient()
  const { session, accountId } = useJmapSession()
  const isEnabled = useAppConfig()?.saveToDriveEnabled === true
  const driveSdk = useDriveSdk()
  const sdk = isEnabled ? driveSdk : null
  const { colorScheme = 'light' } = useColorScheme()
  const endpoint = getBlobAccessEndpoint(session, accountId)
  const move = useDriveIntentDialog(sdk, t('email.drive.moveFrameTitle'))
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set())
  const [saved, setSaved] = useState<ReadonlyMap<string, SavedDriveFile>>(
    new Map()
  )
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const queueRef = useRef<DriveSaveRequest[]>([])
  const isRunningRef = useRef(false)
  const abortRef = useRef(new AbortController())
  const openerRef = useRef<HTMLElement | null>(null)
  const organizedRef = useRef<readonly SavedDriveFile[]>([])

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller
    // shortcut: a file under way when the view goes may still land in
    // Drive, untold; tell it in a global toast if users miss it
    return () => {
      controller.abort()
    }
  }, [])

  const isAvailable = sdk !== null && endpoint !== null

  const organize = useCallback(
    (files: readonly SavedDriveFile[]): void => {
      const [first] = files
      if (first === undefined) return
      organizedRef.current = files
      move.open({
        action: 'MOVE',
        data: {
          fileIds: files.map(file => file.id),
          defaultDirId: first.dirId,
          // A move to a shared drive may give the file a new id
          tabs: ['drive'],
          theme: { type: colorScheme }
        },
        onDocument: document => {
          const [moved] = readMovedFiles(document)
          if (moved !== undefined) {
            notify({
              message: t('email.drive.movedTo', { path: moved.path }),
              severity: 'success'
            })
          }
        }
      })
    },
    [move, colorScheme, notify, t]
  )

  const run = useCallback(async (): Promise<void> => {
    if (sdk === null || endpoint === null || container === null) return
    const signal = abortRef.current.signal
    // Read again after each wait: the view may go meanwhile
    const isAborted = (): boolean => signal.aborted
    const stored: SavedDriveFile[] = []
    let failedCount = 0
    for (
      let file = queueRef.current.shift();
      file !== undefined;
      file = queueRef.current.shift()
    ) {
      if (isAborted()) return
      const { blobId } = file
      // A new token for a blob ends the previous one: asked just before use
      const url = await settleWithin(
        fetchBlobDownloadUrl(client, endpoint, accountId, blobId),
        signal,
        DRIVE_READY_TIMEOUT_MS
      ).catch((error: unknown) => {
        console.warn('[drive] No download token for an attachment', error)
        return null
      })
      const document =
        url === null
          ? null
          : await saveUrlToDrive(
              sdk,
              { url, name: file.name, size: file.size },
              container,
              t('email.drive.frameTitle'),
              signal
            ).catch((error: unknown) => {
              console.warn('[drive] An attachment could not be saved', error)
              return null
            })
      if (isAborted()) return
      setSaving(current => {
        const next = new Set(current)
        next.delete(blobId)
        return next
      })
      if (document === null) {
        failedCount += 1
      } else {
        stored.push(document)
        setSaved(current => new Map(current).set(blobId, document))
      }
    }
    if (stored.length > 0) {
      notify({
        message:
          stored.length === 1
            ? t('email.drive.savedOne', { name: stored[0]?.name ?? '' })
            : t('email.drive.saved', { smart_count: stored.length }),
        severity: 'success',
        action: {
          label: t('email.drive.organize'),
          onClick: () => {
            organize(stored)
          },
          'data-testid': 'save-to-drive-organize-button'
        }
      })
    }
    if (failedCount > 0) {
      notify({
        message: t('email.drive.saveFailed', { smart_count: failedCount }),
        severity: 'error'
      })
    }
  }, [sdk, endpoint, container, client, accountId, notify, organize, t])

  const save = useCallback(
    (files: readonly DriveSaveRequest[]): void => {
      if (!isAvailable) return
      const queued = new Set(queueRef.current.map(file => file.blobId))
      const fresh = files.filter(
        file =>
          !saved.has(file.blobId) &&
          !saving.has(file.blobId) &&
          !queued.has(file.blobId)
      )
      if (fresh.length === 0) return
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      queueRef.current.push(...fresh)
      setSaving(current => {
        const next = new Set(current)
        fresh.forEach(file => next.add(file.blobId))
        return next
      })
      if (isRunningRef.current) return
      isRunningRef.current = true
      run()
        .catch((error: unknown) => {
          console.warn('[drive] Saving the attachments stopped', error)
        })
        .finally(() => {
          isRunningRef.current = false
        })
    },
    [isAvailable, saved, saving, run]
  )

  const openSaved = useCallback(
    (blobId: string): void => {
      const file = saved.get(blobId)
      if (sdk === null || file === undefined) return
      sdk
        .getAppURL('drive', `#/file/${encodeURIComponent(file.id)}`)
        .then(url => {
          if (url !== null) window.open(url, '_blank', 'noopener,noreferrer')
        })
        .catch((error: unknown) => {
          console.warn('[drive] Cannot open the saved file', error)
        })
    },
    [sdk, saved]
  )

  const statusOf = useCallback(
    (blobId: string): DriveSaveStatus =>
      saved.has(blobId) ? 'saved' : saving.has(blobId) ? 'saving' : 'idle',
    [saved, saving]
  )

  const retryOrganize = useCallback((): void => {
    organize(organizedRef.current)
  }, [organize])

  const restoreFocus = useCallback((): void => {
    const element = openerRef.current
    if (element?.isConnected === true) element.focus()
  }, [])

  return {
    isAvailable,
    statusOf,
    save,
    openSaved,
    frameContainerRef: setContainer,
    move,
    retryOrganize,
    restoreFocus
  }
}
