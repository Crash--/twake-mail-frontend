import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography
} from '@linagora/twake-mui'
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

import { useI18n } from '@common/i18n/useI18n'

export interface ConfirmOptions {
  title: string
  message: string
  /** Label of the button that confirms, e.g. "Delete" */
  confirmLabel: string
  /** The confirmed action destroys something: the button says it in red */
  isDestructive?: boolean
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

interface ConfirmApi {
  confirm: Confirm
  choose: Choose
}

const ConfirmContext = createContext<ConfirmApi | null>(null)

interface PendingConfirm extends ConfirmOptions {
  alternativeLabel: string | null
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
 */
export function ConfirmProvider({
  children
}: ConfirmProviderProps): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const messageId = useId()
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const pendingRef = useRef<PendingConfirm | null>(null)

  const ask = useCallback(
    (options: ConfirmOptions, alternativeLabel: string | null) =>
      new Promise<Choice>(resolve => {
        // A dialog asked meanwhile replaces the first one, which is cancelled
        pendingRef.current?.resolve('cancel')
        const next = { ...options, alternativeLabel, resolve }
        pendingRef.current = next
        setPending(next)
      }),
    []
  )
  const api = useMemo<ConfirmApi>(
    () => ({
      confirm: async options => (await ask(options, null)) === 'confirm',
      choose: options => ask(options, options.alternativeLabel)
    }),
    [ask]
  )

  const close = (choice: Choice): void => {
    pendingRef.current?.resolve(choice)
    pendingRef.current = null
    setPending(null)
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

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      <Dialog
        open={pending !== null}
        onClose={handleCancel}
        size="small"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        data-testid="confirm-dialog"
      >
        <DialogTitle id={titleId}>{pending?.title}</DialogTitle>
        <DialogContent>
          {/* Not DialogContentText: text.secondary is below AA contrast
              (docs/twake-mui-gaps.md) */}
          <Typography id={messageId} color="textPrimary">
            {pending?.message}
          </Typography>
        </DialogContent>
        <DialogActions>
          {/* Inherit: primary text on white is below AA contrast */}
          <Button
            variant="outlined"
            color="inherit"
            onClick={handleCancel}
            autoFocus={!isChoice}
            data-testid="confirm-dialog-cancel-button"
          >
            {t('common.cancel')}
          </Button>
          {isChoice ? (
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleAlternative}
              data-testid="confirm-dialog-alternative-button"
            >
              {pending?.alternativeLabel}
            </Button>
          ) : null}
          <Button
            variant="contained"
            color={pending?.isDestructive === true ? 'error' : 'primary'}
            onClick={handleConfirm}
            autoFocus={isChoice}
            data-testid="confirm-dialog-confirm-button"
          >
            {pending?.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
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

/** Asks for a choice between two ways forward (see `Choose`) */
export function useChoose(): Choose {
  return useConfirmApi().choose
}
