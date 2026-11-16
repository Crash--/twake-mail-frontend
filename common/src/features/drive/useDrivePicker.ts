import type { Sdk } from '@linagora/twake-sdk'
import { Intents } from 'cozy-interapp'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useAppConfig } from '@common/config/AppConfigProvider'
import { useWorkplaceSdk } from '@common/features/platform/PlatformProvider'

import {
  pickerData,
  readPickedFiles,
  readPickerHref,
  type DriveFile,
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
      isReady: boolean
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
 * `TDRIVE_ENABLED`, signed in (OIDC, the Workplace known from the SSO or
 * `WORKPLACE_FQDN_FALLBACK`), with Twake Drive installed. Null otherwise.
 */
export function useDriveSdk(): Sdk | null {
  const isEnabled = useAppConfig()?.tdriveEnabled === true
  const workplaceSdk = useWorkplaceSdk()
  const sdk = isEnabled ? workplaceSdk : null
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
  /** Gets the box the frame of the picker goes in */
  frameContainerRef: (element: HTMLElement | null) => void
  open: () => void
  close: () => void
}

/**
 * The Twake Drive picker, a cozy-interapp intent created with the client
 * of the Workplace (its token, renewed by the client) and shown in the box
 * of `frameContainerRef` once the dialog has it. The picked files go to
 * `onFiles`; Cancel closes it. The picker may ask for a size (`resize`,
 * set by cozy-interapp on the box) and for the close button of the dialog
 * (`showCross`, `hideCross`).
 *
 * Closing or unmounting stops the intent (its frame and its listener go),
 * and a late answer of the stack is ignored (Twake Calendar misses it,
 * linagora/twake-calendar-frontend#1498).
 */
export function useDrivePicker(
  sdk: Sdk | null,
  options: DrivePickerOptions,
  onFiles: (files: DriveFile[]) => void,
  /** Title of the frame, for screen readers */
  frameTitle: string
): DrivePicker {
  const [state, setState] = useState<DrivePickerState>({ status: 'closed' })
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const runRef = useRef(0)
  // The run whose intent is being created or shown: started once
  const startedRunRef = useRef<number | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  // The latest labels and callback, read when the picker answers
  const optionsRef = useRef(options)
  const onFilesRef = useRef(onFiles)
  const frameTitleRef = useRef(frameTitle)
  useEffect(() => {
    optionsRef.current = options
    onFilesRef.current = onFiles
    frameTitleRef.current = frameTitle
  })

  const stop = useCallback((): void => {
    runRef.current += 1
    stopRef.current?.()
    stopRef.current = null
  }, [])

  const close = useCallback((): void => {
    stop()
    setState({ status: 'closed' })
  }, [stop])

  const fail = useCallback((): void => {
    stop()
    setState({ status: 'failed' })
  }, [stop])

  const open = useCallback((): void => {
    if (sdk === null) return
    stop()
    setState({ status: 'opening' })
  }, [sdk, stop])

  const isOpening = state.status === 'opening'

  useEffect(() => {
    const run = runRef.current
    if (!isOpening || sdk === null || container === null) return
    if (startedRunRef.current === run) return
    startedRunRef.current = run
    const isCurrent = (): boolean => runRef.current === run
    const update =
      (patch: { isReady?: boolean; showCloseButton?: boolean }) => (): void => {
        if (!isCurrent()) return
        setState(current =>
          current.status === 'open' ? { ...current, ...patch } : current
        )
      }
    const start = async (): Promise<void> => {
      const intent = new Intents({ client: sdk }).create(
        'PICK',
        'io.cozy.files',
        pickerData(optionsRef.current),
        ['GET']
      )
      // Framed only when the picker is an https page
      if (readPickerHref(await intent) === null) {
        throw new Error('No picker in the intent')
      }
      if (!isCurrent()) return
      const started = intent.start(container, {
        title: frameTitleRef.current,
        // The dialog keeps it, Escape working, until the picker is ready
        focus: false,
        onReadyToUse: update({ isReady: true }),
        onShowCross: update({ showCloseButton: true }),
        onHideCross: update({ showCloseButton: false })
      })
      stopRef.current = () => {
        started.stop()
      }
      setState({ status: 'open', isReady: false, showCloseButton: false })
      const document = await started
      if (!isCurrent()) return
      close()
      if (document !== null) onFilesRef.current(readPickedFiles(document))
    }
    start().catch((error: unknown) => {
      console.warn('[drive] The picker could not open', error)
      if (isCurrent()) fail()
    })
  }, [isOpening, sdk, container, close, fail])

  // Unmounted: a pending intent creation is ignored, a shown one stopped
  useEffect(() => stop, [stop])

  const isLoading = state.status === 'open' && !state.isReady
  useEffect(() => {
    if (!isLoading) return undefined
    const timer = window.setTimeout(fail, DRIVE_READY_TIMEOUT_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [isLoading, fail])

  return { state, frameContainerRef: setContainer, open, close }
}
