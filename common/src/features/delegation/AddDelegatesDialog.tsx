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

import { PeopleList } from '@/ds/PeopleList/PeopleList'
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
 * to give full access to their mailbox, then a confirmation listing them,
 * whose "Add" creates the delegations
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
  const [step, setStep] = useState<'pick' | 'confirm'>('pick')
  const [picked, setPicked] = useState<readonly string[]>([])
  const [typed, setTyped] = useState('')
  const [problem, setProblem] = useState<TranslationKey | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const domain = domainOf(ownAddress)
  const names = useContactNames(picked)
  const nameOf = (address: string): string => names[address] ?? address

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
  // The chips, and what is still typed (an address not yet a chip)
  const candidates = mergeEmails(picked, emailsOf(typed))
  const firstRefusal =
    candidates.map(refusal).find(reason => reason !== null) ?? null
  const canGoOn = candidates.length > 0 && firstRefusal === null
  // Said as soon as a chip, or a whole address typed, cannot be given
  // access: Next stays disabled
  const typedAddress = typed.trim()
  const typedRefusal = isValidEmail(typedAddress) ? refusal(typedAddress) : null
  const shownProblem =
    problem ??
    picked.map(refusal).find(reason => reason !== null) ??
    typedRefusal

  const handleNext = (): void => {
    if (!canGoOn) {
      setProblem(firstRefusal ?? 'delegation.errors.empty')
      fieldRef.current?.focus()
      return
    }
    setPicked(candidates)
    setTyped('')
    setStep('confirm')
  }

  const handleAdd = (): void => {
    setIsSaving(true)
    onAdd(picked, names)
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
        {step === 'pick' ? (
          <>
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
          </>
        ) : (
          <>
            <Typography id={textId} component="p" className="u-mb-1">
              {t('delegation.add.confirm', { smart_count: picked.length })}
            </Typography>
            <PeopleList
              label={t('delegation.add.confirmList')}
              people={picked.map(address => ({
                id: address,
                name: nameOf(address),
                address: nameOf(address) === address ? null : address,
                avatarKey: address
              }))}
              data-testid="delegation-add-confirm-list"
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          color="primary"
          onClick={step === 'pick' ? onClose : () => setStep('pick')}
          data-testid="delegation-add-cancel-button"
        >
          {step === 'pick' ? t('common.cancel') : t('delegation.add.back')}
        </Button>
        {step === 'pick' ? (
          <Button
            variant="contained"
            disabled={!canGoOn}
            onClick={handleNext}
            data-testid="delegation-add-next-button"
          >
            {t('delegation.add.next')}
          </Button>
        ) : (
          <Button
            variant="contained"
            disabled={isSaving}
            onClick={handleAdd}
            data-testid="delegation-add-confirm-button"
          >
            {t('delegation.add.submit')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
