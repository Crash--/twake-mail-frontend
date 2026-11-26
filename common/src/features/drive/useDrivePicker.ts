import type { Sdk } from '@linagora/twake-sdk'
import { useQuery } from '@tanstack/react-query'
import { Intents } from 'cozy-interapp'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useAppConfig } from '@common/config/AppConfigProvider'
import { useAuthService } from '@common/features/auth/AuthProvider'
import { ecosystemQueryOptions } from '@common/features/ecosystem/ecosystem'
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
 * The client of the Twake Workplace of the user when the composer may use
 * Drive (its picker, the files too large for the server): `TDRIVE_ENABLED`,
 * not turned off by `driveAttachment.enabled` of the ecosystem of the server
 * (on while it loads or when it cannot be read, as tmail-flutter), signed in
 * (OIDC, the Workplace known from the SSO or `WORKPLACE_FQDN_FALLBACK`),
 * with Twake Drive installed. Null otherwise.
 */
export function useDriveSdk(): Sdk | null {
  const config = useAppConfig()
  const authService = useAuthService()
  const isConfigured = config?.tdriveEnabled === true
  const ecosystem = useQuery({
    ...ecosystemQueryOptions(config?.ecosystemUrl ?? '', authService),
    enabled: isConfigured && config.ecosystemUrl !== ''
  })
  const isEnabled =
    isConfigured && (ecosystem.data?.driveAttachmentEnabled ?? true)
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

/** A Drive intent shown in a dialog: PICK files, MOVE files */
export interface DriveIntentRequest {
  action: 'PICK' | 'MOVE'
  data: Record<string, unknown>
  /** What the service ends with; not called when it is cancelled */
  onDocument: (document: unknown) => void
}

export interface DriveIntentDialog {
  state: DrivePickerState
  /** Gets the box the frame of the intent goes in */
  frameContainerRef: (element: HTMLElement | null) => void
  open: (request: DriveIntentRequest) => void
  close: () => void
}

/**
 * The Twake Drive picker: picked files go to `onFiles`, Cancel closes it.
 * See `useDriveIntentDialog`.
 */
export function useDrivePicker(
  sdk: Sdk | null,
  options: DrivePickerOptions,
  onFiles: (files: DriveFile[]) => void,
  /** Title of the frame, for screen readers */
  frameTitle: string
): DrivePicker {
  const dialog = useDriveIntentDialog(sdk, frameTitle)
  const { open: openDialog } = dialog
  // The latest labels and callback, read when the picker opens and answers
  const optionsRef = useRef(options)
  const onFilesRef = useRef(onFiles)
  useEffect(() => {
    optionsRef.current = options
    onFilesRef.current = onFiles
  })
  const open = useCallback((): void => {
    openDialog({
      action: 'PICK',
      data: pickerData(optionsRef.current),
      onDocument: document => {
        onFilesRef.current(readPickedFiles(document))
      }
    })
  }, [openDialog])
  return { ...dialog, open }
}

/**
 * A Twake Drive intent with a UI (the picker, the move), a cozy-interapp
 * intent created with the client of the Workplace (its token, renewed by
 * the client) and shown in the box of `frameContainerRef` once the dialog
 * has it. The service may ask for a size (`resize`, set by cozy-interapp on
 * the box) and for the close button of the dialog (`showCross`,
 * `hideCross`).
 *
 * Closing or unmounting stops the intent (its frame and its listener go),
 * and a late answer of the stack is ignored (Twake Calendar misses it,
 * linagora/twake-calendar-frontend#1498).
 */
export function useDriveIntentDialog(
  sdk: Sdk | null,
  /** Title of the frame, for screen readers */
  frameTitle: string
): DriveIntentDialog {
  const [state, setState] = useState<DrivePickerState>({ status: 'closed' })
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const runRef = useRef(0)
  // The run whose intent is being created or shown: started once
  const startedRunRef = useRef<number | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  // The intent of the run, set by `open`
  const requestRef = useRef<DriveIntentRequest | null>(null)
  const frameTitleRef = useRef(frameTitle)
  useEffect(() => {
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

  const open = useCallback(
    (request: DriveIntentRequest): void => {
      if (sdk === null) return
      stop()
      requestRef.current = request
      setState({ status: 'opening' })
    },
    [sdk, stop]
  )

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
    const request = requestRef.current
    if (request === null) return
    const start = async (): Promise<void> => {
      const intent = new Intents({ client: sdk }).create(
        request.action,
        'io.cozy.files',
        request.data,
        ['GET']
      )
      // Framed only when the service is an https page
      if (readPickerHref(await intent) === null) {
        throw new Error('No service page in the intent')
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
      if (document !== null) request.onDocument(document)
    }
    start().catch((error: unknown) => {
      console.warn(`[drive] The ${request.action} intent could not open`, error)
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
