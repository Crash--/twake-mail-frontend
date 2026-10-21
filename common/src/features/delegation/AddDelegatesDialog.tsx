import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormHelperText,
  Typography
} from '@linagora/twake-mui'
import { useId, useRef, useState, type ReactElement } from 'react'

import type { RecipientFieldActions } from '@/ds/RecipientField/RecipientField'
import { isValidEmail } from '@common/features/composer/recipients'
import {
  emailsOf,
  mergeEmails
} from '@common/features/forward/ForwardRecipientField'
import { domainOf } from '@common/features/forward/queries'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

import { DelegateRecipientField } from './DelegateRecipientField'
import { useContactNames } from './useContactNames'

export interface AddDelegatesDialogProps {
  /** The address of the user */
  ownAddress: string
  /** The addresses that already have access */
  delegates: readonly string[]
  /**
   * Gives them access, given their names as the contacts know them;
   * resolves once done (the dialog then closes)
   */
  onAdd: (
    addresses: readonly string[],
    names: Readonly<Record<string, string>>
  ) => Promise<void>
  onClose: () => void
}

/**
 * "Delegate access" (tmail-flutter#4977): the people of the user's domain
 * to give full access to their mailbox, whose "Add" creates the
 * delegations
 */
export function AddDelegatesDialog({
  ownAddress,
  delegates,
  onAdd,
  onClose
}: AddDelegatesDialogProps): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const textId = useId()
  const inputId = useId()
  const problemId = useId()
  const fieldRef = useRef<RecipientFieldActions>(null)
  const [picked, setPicked] = useState<readonly string[]>([])
  const [typed, setTyped] = useState('')
  const [problem, setProblem] = useState<TranslationKey | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const domain = domainOf(ownAddress)
  // The chips, and what is still typed (an address not yet a chip)
  const candidates = mergeEmails(picked, emailsOf(typed))
  const names = useContactNames(candidates.filter(isValidEmail))

  const refusal = (email: string): TranslationKey | null => {
    if (!isValidEmail(email)) return 'delegation.errors.invalid'
    if (email.toLowerCase() === ownAddress.toLowerCase()) {
      return 'delegation.errors.ownAddress'
    }
    if (domainOf(email) !== domain) return 'delegation.errors.otherDomain'
    if (delegates.some(other => other.toLowerCase() === email.toLowerCase())) {
      return 'delegation.errors.alreadyDelegate'
    }
    return null
  }
  const firstRefusal =
    candidates.map(refusal).find(reason => reason !== null) ?? null
  const canAdd = candidates.length > 0 && firstRefusal === null
  // Said as soon as a chip, or a whole address typed, cannot be given
  // access: Add stays disabled
  const typedAddress = typed.trim()
  const typedRefusal = isValidEmail(typedAddress) ? refusal(typedAddress) : null
  const shownProblem =
    problem ??
    picked.map(refusal).find(reason => reason !== null) ??
    typedRefusal

  const handleAdd = (): void => {
    if (!canAdd) {
      setProblem(firstRefusal ?? 'delegation.errors.empty')
      fieldRef.current?.focus()
      return
    }
    setIsSaving(true)
    onAdd(candidates, names)
      .catch((error: unknown) => {
        console.error('[delegation] Cannot add the delegates', error)
      })
      .finally(() => {
        setIsSaving(false)
      })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="small"
      aria-labelledby={titleId}
      aria-describedby={textId}
      data-testid="delegation-add-dialog"
    >
      <DialogTitle id={titleId}>{t('delegation.add.title')}</DialogTitle>
      <DialogContent>
        <Typography id={textId} component="p" className="u-mb-1">
          {t('delegation.add.text')}
        </Typography>
        <label htmlFor={inputId} className="u-visuallyhidden">
          {t('delegation.add.field')}
        </label>
        <DelegateRecipientField
          inputId={inputId}
          values={picked}
          onChange={values => {
            setPicked(values)
            setProblem(null)
          }}
          inputValue={typed}
          onInputChange={value => {
            setTyped(value)
            setProblem(null)
          }}
          domain={domain}
          excluded={[ownAddress, ...delegates]}
          isRefused={email => refusal(email) !== null}
          hasError={shownProblem !== null}
          describedBy={shownProblem === null ? undefined : problemId}
          actions={fieldRef}
        />
        {shownProblem === null ? null : (
          <FormHelperText
            error
            id={problemId}
            data-testid="delegation-input-error"
          >
            {t(shownProblem, { domain })}
          </FormHelperText>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          color="primary"
          onClick={onClose}
          data-testid="delegation-add-cancel-button"
        >
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={!canAdd || isSaving}
          onClick={handleAdd}
          data-testid="delegation-add-confirm-button"
        >
          {t('delegation.add.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
