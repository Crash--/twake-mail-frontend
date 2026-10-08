import { Icon } from '@linagora/twake-icons'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type ReactElement
} from 'react'

import { FolderOutlined } from '@/ds/FlutterIcons/FlutterIcons'
import {
  ModalDialog,
  ModalDialogButton,
  ModalField,
  ModalSelectButton,
  ModalTextInput
} from '@/ds/ModalDialog/ModalDialog'
import { useI18n, type TranslationKey } from '@common/i18n/useI18n'

export interface MailboxNameDialogLocation {
  /** Path of the parent folder, or "Personal folders" for the top level */
  path: string
  onChange: () => void
}

export interface MailboxNameDialogProps {
  title: string
  submitLabel: string
  initialName: string
  /** Where a new folder goes, and the button changing it */
  location?: MailboxNameDialogLocation | null
  validate: (name: string) => TranslationKey | null
  onSubmit: (name: string) => void
  onClose: () => void
}

/**
 * Names a folder, to create or rename it, as tmail-flutter's dialog: the
 * name field (selected when renaming), where the folder goes (creating), and
 * the problem with the name under the field once the user typed or
 * submitted, tied to it (`aria-describedby`, `aria-invalid`).
 */
export function MailboxNameDialog({
  title,
  submitLabel,
  initialName,
  location = null,
  validate,
  onSubmit,
  onClose
}: MailboxNameDialogProps): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const locationId = useId()
  const inputId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialName)
  const [isTouched, setIsTouched] = useState(false)
  const problem = validate(name)
  // The dialog takes the focus as it opens: the name gets it once there
  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])
  const shownProblem = isTouched ? problem : null

  const handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault()
    setIsTouched(true)
    if (problem !== null) {
      inputRef.current?.focus()
      return
    }
    onSubmit(name.trim())
  }

  const field = (
    <ModalTextInput
      id={inputId}
      inputRef={inputRef}
      autoFocus
      placeholder={t('folders.create.placeholder')}
      value={name}
      onChange={event => {
        setName(event.target.value)
        setIsTouched(true)
      }}
      onFocus={event => {
        event.target.select()
      }}
      error={shownProblem === null ? null : t(shownProblem)}
      errorId={errorId}
      inputProps={{
        'aria-label': location !== null ? undefined : t('folders.create.name'),
        'aria-invalid': shownProblem !== null,
        'aria-describedby': shownProblem === null ? undefined : errorId,
        'data-testid': 'mailbox-name-input'
      }}
    />
  )

  // As tmail-flutter: creating, the large modal with where the folder goes;
  // renaming, the small one with the field alone
  const isCreating = location !== null
  return (
    <ModalDialog
      title={title}
      titleId={titleId}
      subtitle={
        location === null
          ? undefined
          : t('folders.create.subtitle', { folderName: location.path })
      }
      size={isCreating ? 'large' : 'small'}
      closeLabel={t('common.close')}
      onClose={onClose}
      onSubmit={handleSubmit}
      actions={
        <>
          <ModalDialogButton
            onClick={onClose}
            data-testid="mailbox-name-cancel-button"
          >
            {t('common.cancel')}
          </ModalDialogButton>
          <ModalDialogButton
            type="submit"
            isMain
            data-testid="mailbox-name-submit-button"
          >
            {submitLabel}
          </ModalDialogButton>
        </>
      }
      data-testid="mailbox-name-dialog"
    >
      {isCreating ? (
        <ModalField
          label={t('folders.create.name')}
          htmlFor={inputId}
          spaceAbove={0}
        >
          {field}
        </ModalField>
      ) : (
        field
      )}
      {location === null ? null : (
        <ModalField label={t('folders.create.location')} id={locationId}>
          <ModalSelectButton
            icon={<Icon icon={FolderOutlined} size={20} />}
            onClick={location.onChange}
            aria-describedby={locationId}
            aria-haspopup="dialog"
            data-testid="mailbox-name-location-button"
          >
            {location.path}
          </ModalSelectButton>
        </ModalField>
      )}
    </ModalDialog>
  )
}
