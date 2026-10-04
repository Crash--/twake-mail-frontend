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

const ConfirmContext = createContext<Confirm | null>(null)

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void
}

export interface ConfirmProviderProps {
  children: ReactNode
}

/**
 * Confirmation dialogs: `await confirm({ title, message, confirmLabel })`.
 * The dialog takes the focus (on "Cancel": the safe choice) and gives it
 * back to what had it when it closes; Escape cancels.
 */
export function ConfirmProvider({
  children
}: ConfirmProviderProps): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const messageId = useId()
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const pendingRef = useRef<PendingConfirm | null>(null)

  const confirm = useCallback<Confirm>(
    options =>
      new Promise<boolean>(resolve => {
        // A dialog asked meanwhile replaces the first one, which is cancelled
        pendingRef.current?.resolve(false)
        const next = { ...options, resolve }
        pendingRef.current = next
        setPending(next)
      }),
    []
  )

  const close = (confirmed: boolean): void => {
    pendingRef.current?.resolve(confirmed)
    pendingRef.current = null
    setPending(null)
  }
  const handleCancel = (): void => {
    close(false)
  }
  const handleConfirm = (): void => {
    close(true)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
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
            autoFocus
            data-testid="confirm-dialog-cancel-button"
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color={pending?.isDestructive === true ? 'error' : 'primary'}
            onClick={handleConfirm}
            data-testid="confirm-dialog-confirm-button"
          >
            {pending?.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

/** Asks for a confirmation; needs a `ConfirmProvider` (in `AppProviders`) */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm needs a ConfirmProvider')
  return confirm
}
