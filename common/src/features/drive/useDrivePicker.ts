import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAppConfig } from '@common/config/AppConfigProvider'
import {
  useAuthService,
  useAuthState
} from '@common/features/auth/AuthProvider'
import { useJmapSession } from '@common/jmap/JmapSessionProvider'

import {
  createDriveIntent,
  exchangeDriveToken,
  resolveDriveUrl,
  type DriveResult
} from './driveApi'
import {
  pickerData,
  readIntentMessage,
  type DriveFile,
  type DriveFrameSize,
  type DriveIntent,
  type DrivePickerOptions
} from './driveIntent'

/** Time the picker has to say it is ready (a cross-origin frame tells no load error) */
export const DRIVE_READY_TIMEOUT_MS = 20_000

export type DrivePickerState =
  | { status: 'closed' }
  | { status: 'opening' }
  | {
      status: 'open'
      intent: DriveIntent
      isReady: boolean
      /** The size the picker asked for (`resize`), null for the default */
      size: DriveFrameSize | null
      /**
       * The picker asked the dialog to show its close button (`showCross`,
       * undone by `hideCross`). False by default: Drive has its own, in its
       * header, which cancels the intent; the dialog shows its own only
       * while the picker loads.
       */
      showCloseButton: boolean
    }
  | { status: 'failed' }

/**
 * The address of the Drive of the user when the picker is offered:
 * `TDRIVE_ENABLED` with a `TDRIVE_INTENT_URL` that resolves, and an OIDC
 * session (its ID token is traded for a Drive token). Null otherwise.
 */
export function useDriveUrl(): string | null {
  const config = useAppConfig()
  const service = useAuthService()
  const state = useAuthState()
  const { session } = useJmapSession()
  const workplaceFqdn =
    state.status === 'authenticated' ? state.user.workplaceFqdn : null
  return useMemo(
    () =>
      service.mode === 'oidc'
        ? resolveDriveUrl(config?.tdriveIntentUrl ?? null, {
            username: session.username,
            workplaceFqdn,
            workplaceFqdnFallback: config?.workplaceFqdnFallback ?? null
          })
        : null,
    [
      service.mode,
      config?.tdriveIntentUrl,
      config?.workplaceFqdnFallback,
      session.username,
      workplaceFqdn
    ]
  )
}

export interface DrivePicker {
  state: DrivePickerState
  /** The frame of the picker, whose messages are listened to */
  frameRef: React.MutableRefObject<HTMLIFrameElement | null>
  open: () => void
  close: () => void
}

/**
 * The Twake Drive picker: trades the ID token for a Drive token (one more
 * try after renewing the session, as tmail-flutter), creates the intent,
 * then listens to the messages of its frame only: from the origin of the
 * intent, from its window, with its id, while it is open. The picked files
 * go to `onFiles`; Cancel closes it. The picker may ask for a size
 * (`resize`) and for the close button of the dialog (`showCross`,
 * `hideCross`), as cozy-interapp lets it.
 *
 * Closing or unmounting removes the `message` listener and the frame (its
 * `src` goes, so the dialog drops it), and a late answer of the stack is
 * ignored: what cozy-interapp's `destroy` does (Twake Calendar misses it,
 * linagora/twake-calendar-frontend#1498).
 */
export function useDrivePicker(
  driveUrl: string | null,
  options: DrivePickerOptions,
  onFiles: (files: DriveFile[]) => void
): DrivePicker {
  const service = useAuthService()
  const [state, setState] = useState<DrivePickerState>({ status: 'closed' })
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const runRef = useRef(0)
  // The latest labels and callback, read by the message handler
  const optionsRef = useRef(options)
  const onFilesRef = useRef(onFiles)
  useEffect(() => {
    optionsRef.current = options
    onFilesRef.current = onFiles
  })

  const close = useCallback((): void => {
    runRef.current += 1
    setState({ status: 'closed' })
  }, [])

  const open = useCallback((): void => {
    if (driveUrl === null || service.mode !== 'oidc') return
    const run = runRef.current + 1
    runRef.current = run
    setState({ status: 'opening' })
    const exchange = async (): Promise<DriveResult<string>> => {
      const idToken = service.getIdToken()
      const first =
        idToken === null
          ? ({ ok: false, error: 'token' } as const)
          : await exchangeDriveToken(driveUrl, idToken)
      if (first.ok || first.error !== 'token') return first
      // An ID token past its lifetime: renewed once
      if (!(await service.refresh())) return first
      const renewed = service.getIdToken()
      return renewed === null ? first : exchangeDriveToken(driveUrl, renewed)
    }
    const start = async (): Promise<void> => {
      const token = await exchange()
      const intent = token.ok
        ? await createDriveIntent(
            driveUrl,
            token.value,
            pickerData(optionsRef.current)
          )
        : token
      if (runRef.current !== run) return
      setState(
        intent.ok
          ? {
              status: 'open',
              intent: intent.value,
              isReady: false,
              size: null,
              showCloseButton: false
            }
          : { status: 'failed' }
      )
    }
    start().catch((error: unknown) => {
      console.warn('[drive] The picker could not open', error)
      if (runRef.current === run) setState({ status: 'failed' })
    })
  }, [driveUrl, service])

  const intent = state.status === 'open' ? state.intent : null
  const isReady = state.status === 'open' && state.isReady

  useEffect(() => {
    if (intent === null) return undefined
    const handleMessage = (event: MessageEvent): void => {
      const frame = frameRef.current?.contentWindow ?? null
      if (frame === null || event.source !== frame) return
      const message = readIntentMessage(event, intent)
      if (message === null) return
      switch (message.type) {
        case 'ready':
          // Only to the origin of the intent, never '*'
          frame.postMessage(pickerData(optionsRef.current), intent.origin)
          return
        case 'readyToUse':
          setState(current =>
            current.status === 'open' ? { ...current, isReady: true } : current
          )
          return
        case 'resize':
          setState(current =>
            current.status === 'open'
              ? { ...current, size: message.size }
              : current
          )
          return
        case 'hideCross':
        case 'showCross': {
          const showCloseButton = message.type === 'showCross'
          setState(current =>
            current.status === 'open'
              ? { ...current, showCloseButton }
              : current
          )
          return
        }
        case 'done':
          close()
          onFilesRef.current(message.files)
          return
        case 'cancel':
          close()
          return
        case 'error':
          setState({ status: 'failed' })
      }
    }
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [intent, close])

  // Unmounted: a pending token exchange or intent creation is ignored
  useEffect(
    () => () => {
      runRef.current += 1
    },
    []
  )

  useEffect(() => {
    if (intent === null || isReady) return undefined
    const timer = window.setTimeout(() => {
      setState({ status: 'failed' })
    }, DRIVE_READY_TIMEOUT_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [intent, isReady])

  return { state, frameRef, open, close }
}
