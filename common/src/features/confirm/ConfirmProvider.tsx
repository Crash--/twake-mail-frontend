import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import {
  ConfirmDialogButton,
  ConfirmDialogFrame
} from '@/ds/ConfirmDialogFrame/ConfirmDialogFrame'
import { useI18n } from '@common/i18n/useI18n'

export interface ConfirmOptions {
  title: string
  message: string
  /** Label of the button that confirms, e.g. "Delete" */
  confirmLabel: string
  /** The confirmed action destroys something: the button says it in red */
  isDestructive?: boolean
  /** Label of the button that declines, "Cancel" by default (e.g. "No") */
  cancelLabel?: string
  /**
   * Waits for the dialogs already asked to be answered, instead of
   * replacing them (each one cancelled): questions the user must answer
   * one after the other, such as the read receipts of a conversation
   */
  queue?: boolean
}

/** Asks the user; resolves true when they confirm, false otherwise */
export type Confirm = (options: ConfirmOptions) => Promise<boolean>

export interface ChoiceOptions extends ConfirmOptions {
  /** Label of the other way out, e.g. "Discard changes" */
  alternativeLabel: string
}

/** What the user chose; `cancel` for Cancel, Escape or a click outside */
export type Choice = 'confirm' | 'alternative' | 'cancel'

/**
 * Offers two ways forward, e.g. save or discard before closing; the
 * dialog takes the focus on the confirm button
 */
export type Choose = (options: ChoiceOptions) => Promise<Choice>

/** Tells the user something blocking; resolves once they acknowledged it */
export type Alert = (
  options: Omit<ConfirmOptions, 'isDestructive' | 'cancelLabel'>
) => Promise<void>

interface ConfirmApi {
  confirm: Confirm
  choose: Choose
  alert: Alert
}

const ConfirmContext = createContext<ConfirmApi | null>(null)

interface PendingConfirm extends ConfirmOptions {
  alternativeLabel: string | null
  /** An alert: its one button acknowledges */
  isAlert: boolean
  resolve: (choice: Choice) => void
}

export interface ConfirmProviderProps {
  children: ReactNode
}

/**
 * Confirmation dialogs: `await confirm({ title, message, confirmLabel })`,
 * or `await choose({ …, alternativeLabel })` for a third button. The
 * dialog takes the focus (on "Cancel", the safe choice, for a
 * confirmation; on the confirm button for a choice) and gives it back to
 * what had it when it closes; Escape cancels.
 *
 * A dialog asked while another is open replaces it, the first one
 * cancelled, unless it asks to `queue`: it then waits for the open dialog
 * and those queued before it, each shown once the previous one has closed.
 */
export function ConfirmProvider({
  children
}: ConfirmProviderProps): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const messageId = useId()
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const pendingRef = useRef<PendingConfirm | null>(null)
  /** Asked with `queue` while a dialog was open: shown in this order */
  const queueRef = useRef<PendingConfirm[]>([])

  const show = (next: PendingConfirm | null): void => {
    pendingRef.current = next
    setPending(next)
  }

  const ask = useCallback(
    (
      options: ConfirmOptions,
      alternativeLabel: string | null,
      isAlert = false
    ) =>
      new Promise<Choice>(resolve => {
        const next = { ...options, alternativeLabel, isAlert, resolve }
        const isBusy =
          pendingRef.current !== null || queueRef.current.length > 0
        if (options.queue === true && isBusy) {
          queueRef.current.push(next)
          return
        }
        // A dialog asked meanwhile replaces the first one, which is cancelled
        pendingRef.current?.resolve('cancel')
        show(next)
      }),
    []
  )
  const api = useMemo<ConfirmApi>(
    () => ({
      confirm: async options => (await ask(options, null)) === 'confirm',
      choose: options => ask(options, options.alternativeLabel),
      alert: async options => {
        await ask(options, null, true)
      }
    }),
    [ask]
  )

  const close = (choice: Choice): void => {
    pendingRef.current?.resolve(choice)
    show(null)
  }
  // The next question once the dialog has gone: a new dialog, announced
  // as such, which gives the focus back where it was when all are answered
  const handleExited = (): void => {
    // Once the dialog has unmounted, not while it is still leaving
    requestAnimationFrame(() => {
      if (pendingRef.current !== null) return
      const next = queueRef.current.shift()
      if (next) show(next)
    })
  }
  const handleCancel = (): void => {
    close('cancel')
  }
  const handleAlternative = (): void => {
    close('alternative')
  }
  const handleConfirm = (): void => {
    close('confirm')
  }
  const isChoice = (pending?.alternativeLabel ?? null) !== null
  const isAlert = pending?.isAlert ?? false

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {/* tmail-flutter's confirmation dialog: its confirming button is the
          blue pill even when it destroys, the title says what it does */}
      <ConfirmDialogFrame
        open={pending !== null}
        title={pending?.title}
        message={pending?.message}
        closeLabel={t('common.close')}
        onClose={handleCancel}
        onExited={handleExited}
        titleId={titleId}
        messageId={messageId}
        data-testid="confirm-dialog"
      >
        {isAlert ? null : (
          <ConfirmDialogButton
            onClick={handleCancel}
            autoFocus={!isChoice}
            data-testid="confirm-dialog-cancel-button"
          >
            {pending?.cancelLabel ?? t('common.cancel')}
          </ConfirmDialogButton>
        )}
        {isChoice ? (
          <ConfirmDialogButton
            onClick={handleAlternative}
            data-testid="confirm-dialog-alternative-button"
          >
            {pending?.alternativeLabel}
          </ConfirmDialogButton>
        ) : null}
        <ConfirmDialogButton
          isMain
          onClick={handleConfirm}
          autoFocus={isChoice || isAlert}
          data-testid="confirm-dialog-confirm-button"
        >
          {pending?.confirmLabel}
        </ConfirmDialogButton>
      </ConfirmDialogFrame>
    </ConfirmContext.Provider>
  )
}

function useConfirmApi(): ConfirmApi {
  const api = useContext(ConfirmContext)
  if (!api) throw new Error('useConfirm needs a ConfirmProvider')
  return api
}

/** Asks for a confirmation; needs a `ConfirmProvider` (in `AppProviders`) */
export function useConfirm(): Confirm {
  return useConfirmApi().confirm
}

/** Tells something blocking, in a dialog with one button (see `Alert`) */
export function useAlert(): Alert {
  return useConfirmApi().alert
}

/** Asks for a choice between two ways forward (see `Choose`) */
export function useChoose(): Choose {
  return useConfirmApi().choose
}
