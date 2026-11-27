import type { Sdk } from '@linagora/twake-sdk'
import { Intents } from 'cozy-interapp'

import { MAIL_FOLDER_ID } from './useDriveUpload'
import { DRIVE_READY_TIMEOUT_MS } from './useDrivePicker'

/**
 * Time a URL upload may take once Drive is ready: it reports no progress.
 * Past it the outcome is unknown: the file may still land in Drive, so it is
 * never sent again on its own (as Twake Calendar).
 */
export const DRIVE_URL_UPLOAD_TIMEOUT_MS = 120_000

/** Time the LOOKUP intent may take once Drive is ready */
export const DRIVE_LOOKUP_TIMEOUT_MS = 30_000

/** A file Drive stored, what "Organize" and "See in Drive" need */
export interface SavedDriveFile {
  id: string
  name: string
  dirId: string
}

/** A file the MOVE intent moved, with the path of its new folder */
export interface MovedDriveFile {
  id: string
  name: string
  path: string
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function readSize(value: unknown): number | null {
  if (typeof value === 'number') return value
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null
}

/**
 * The `io.cozy.files` document the UPLOAD intent ends with, when it holds
 * `size` bytes. Another size is no saved file: a stack without `SourceURL`
 * stores an empty file, a proxy that does not route the download URL an
 * HTML page.
 */
export function readSavedFile(
  document: unknown,
  size: number
): SavedDriveFile | null {
  if (typeof document !== 'object' || document === null) return null
  const record = document as Record<string, unknown>
  const id = readString(record._id) ?? readString(record.id)
  const name = readString(record.name)
  const dirId = readString(record.dir_id)
  if (id === null || name === null || dirId === null) return null
  return readSize(record.size) === size ? { id, name, dirId } : null
}

/** The documents the MOVE intent ends with: a move across drives may give a new id */
export function readMovedFiles(result: unknown): MovedDriveFile[] {
  if (!Array.isArray(result)) return []
  return result.flatMap((document: unknown): MovedDriveFile[] => {
    if (typeof document !== 'object' || document === null) return []
    const record = document as Record<string, unknown>
    const id = readString(record._id) ?? readString(record.id)
    const name = readString(record.name)
    const path = readString(record.path)
    return id !== null && name !== null && path !== null
      ? [{ id, name, path }]
      : []
  })
}

/**
 * `promise`, or null once `signal` aborts or `ms` pass: a request that
 * hangs must not keep the files after it waiting
 */
export async function settleWithin<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  ms: number
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort = (): void => undefined
  const cut = new Promise<null>(resolve => {
    onAbort = () => {
      resolve(null)
    }
    timer = setTimeout(onAbort, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  if (signal.aborted) onAbort()
  try {
    return await Promise.race([promise, cut])
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
  }
}

/**
 * An intent of Drive with no interface, its frame hidden in `element`: what
 * it ends with, or null when it was cut by `signal` or took too long
 * (`readyTimeout` to get ready, then `timeout` to end). Rejects when Drive
 * answers an error.
 */
async function runHiddenIntent(
  sdk: Sdk,
  action: string,
  data: Record<string, unknown>,
  element: HTMLElement,
  frameTitle: string,
  signal: AbortSignal,
  readyTimeout: number,
  timeout: number
): Promise<unknown> {
  const intent = new Intents({ client: sdk }).create(
    action,
    'io.cozy.files',
    data
  )
  // `null` when the creation was cut: the intent is not started then
  const created = await settleWithin(
    intent.then(() => true),
    signal,
    readyTimeout
  )
  if (created === null || signal.aborted) return null
  const started = intent.start(element, {
    title: frameTitle,
    focus: false,
    readyTimeout
  })
  try {
    return await settleWithin(started, signal, timeout)
  } finally {
    // A stopped intent never settles; stopping a settled one is harmless
    started.stop()
  }
}

/**
 * One file into the Mail folder of Drive through the UPLOAD intent from a
 * URL (twake-drive `docs/upload-intent.md`): the stack downloads it, the
 * browser never sees its bytes. Resolves with what Drive stored, null when
 * it failed, stopped or took too long; the frame goes in `element`, hidden.
 */
export async function saveUrlToDrive(
  sdk: Sdk,
  file: {
    url: string
    name: string
    size: number
    /** Where the file comes from, kept on the file by Drive */
    reference?: { type: string; id: string } | null
  },
  element: HTMLElement,
  frameTitle: string,
  signal: AbortSignal,
  {
    readyTimeout = DRIVE_READY_TIMEOUT_MS,
    uploadTimeout = DRIVE_URL_UPLOAD_TIMEOUT_MS
  }: { readyTimeout?: number; uploadTimeout?: number } = {}
): Promise<SavedDriveFile | null> {
  const document = await runHiddenIntent(
    sdk,
    'UPLOAD',
    {
      url: file.url,
      folderId: MAIL_FOLDER_ID,
      name: file.name,
      ...(file.reference ? { reference: file.reference } : {})
    },
    element,
    frameTitle,
    signal,
    readyTimeout,
    uploadTimeout
  )
  return readSavedFile(document, file.size)
}

/**
 * The ids of the files out of the trash in the result of the LOOKUP
 * intent, by reference id; the others are not saved
 */
export function readLookedUpFiles(result: unknown): Map<string, string> {
  const files: unknown =
    typeof result === 'object' && result !== null
      ? (result as { files?: unknown }).files
      : null
  if (typeof files !== 'object' || files === null) return new Map()
  return new Map(
    Object.entries(files).flatMap(([id, file]): [string, string][] => {
      if (typeof file !== 'object' || file === null) return []
      const { fileId, trashed } = file as {
        fileId?: unknown
        trashed?: unknown
      }
      const fileIdText = readString(fileId)
      return fileIdText !== null && trashed !== true ? [[id, fileIdText]] : []
    })
  )
}

/**
 * The files of Drive that references point to, through the LOOKUP intent
 * (twake-drive `docs/lookup-intent.md`): one hidden frame for them all.
 * Null when Drive did not answer in time or the lookup was cut; rejects
 * when Drive answers an error, or has no LOOKUP.
 */
export async function lookupSavedFiles(
  sdk: Sdk,
  references: readonly { type: string; id: string }[],
  element: HTMLElement,
  frameTitle: string,
  signal: AbortSignal,
  {
    readyTimeout = DRIVE_READY_TIMEOUT_MS,
    lookupTimeout = DRIVE_LOOKUP_TIMEOUT_MS
  }: { readyTimeout?: number; lookupTimeout?: number } = {}
): Promise<Map<string, string> | null> {
  const result = await runHiddenIntent(
    sdk,
    'LOOKUP',
    { references },
    element,
    frameTitle,
    signal,
    readyTimeout,
    lookupTimeout
  )
  return result === null ? null : readLookedUpFiles(result)
}
