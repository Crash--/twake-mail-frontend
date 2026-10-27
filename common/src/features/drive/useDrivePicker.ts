import type { Sdk } from '@linagora/twake-sdk'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useWorkplaceSdk } from '@common/features/platform/PlatformProvider'

import {
  pickerData,
  readIntent,
  readIntentMessage,
  type DriveFile,
  type DriveFrameSize,
  type DriveIntent,
  type DrivePickerOptions
} from './driveIntent'

/** Slug of Twake Drive on the Workplace, the service of `PICK io.cozy.files` */
const DRIVE_SLUG = 'drive'

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
 * The client of the Twake Workplace of the user when the picker is offered:
 * signed in (OIDC, the Workplace known from the SSO or
 * `WORKPLACE_FQDN_FALLBACK`), with Twake Drive installed. Null otherwise.
 */
export function useDriveSdk(): Sdk | null {
  const sdk = useWorkplaceSdk()
  // The client the apps were read from, when Drive is one of them
  const [driveSdk, setDriveSdk] = useState<Sdk | null>(null)
  useEffect(() => {
    if (sdk === null) return
    let isCurrent = true
    // The client keeps the apps for the page, the platform bar asks for them too
    sdk
      .getAllApps()
      .then(apps => {
        if (isCurrent) {
          setDriveSdk(apps.some(app => app.slug === DRIVE_SLUG) ? sdk : null)
        }
      })
      .catch((error: unknown) => {
        console.warn('[drive] Cannot read the apps of the Workplace', error)
      })
    return () => {
      isCurrent = false
    }
  }, [sdk])
  return driveSdk !== null && driveSdk === sdk ? sdk : null
}

export interface DrivePicker {
  state: DrivePickerState
  /** The frame of the picker, whose messages are listened to */
  frameRef: React.RefObject<HTMLIFrameElement | null>
  open: () => void
  close: () => void
}

/**
 * The Twake Drive picker: creates the intent with the client of the
 * Workplace (its token, renewed by the client), then listens to the messages of its frame only: from the origin of the
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
  sdk: Sdk | null,
  options: DrivePickerOptions,
  onFiles: (files: DriveFile[]) => void
): DrivePicker {
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
    if (sdk === null) return
    const run = runRef.current + 1
    runRef.current = run
    setState({ status: 'opening' })
    const start = async (): Promise<void> => {
      const intent = readIntent(
        await sdk.createIntent({
          action: 'PICK',
          type: 'io.cozy.files',
          data: pickerData(optionsRef.current),
          permissions: ['GET']
        })
      )
      if (runRef.current !== run) return
      setState(
        intent === null
          ? { status: 'failed' }
          : {
              status: 'open',
              intent,
              isReady: false,
              size: null,
              showCloseButton: false
            }
      )
    }
    start().catch((error: unknown) => {
      console.warn('[drive] The picker could not open', error)
      if (runRef.current === run) setState({ status: 'failed' })
    })
  }, [sdk])

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
    // The picker posts to its parent: the window its frame is rendered in,
    // which is the overlay of TwakeSpace when the dialog shows there
    const host = frameRef.current?.ownerDocument.defaultView ?? window
    const hosts = host === window ? [window] : [window, host]
    hosts.forEach(target => {
      target.addEventListener('message', handleMessage)
    })
    return () => {
      hosts.forEach(target => {
        target.removeEventListener('message', handleMessage)
      })
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
