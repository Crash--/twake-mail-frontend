import { Icon, FolderOutlined } from '@linagora/twake-icons'
import {
  Button,
  FixedDialog,
  MenuItem,
  TextField,
  Typography
} from '@linagora/twake-mui'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type SubmitEvent,
  type ReactElement
} from 'react'

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
  const formId = useId()
  const locationId = useId()
  const inputId = useId()
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
    <TextField
      id={inputId}
      inputRef={inputRef}
      autoFocus
      fullWidth
      label={location === null ? undefined : t('folders.create.name')}
      placeholder={t('folders.create.placeholder')}
      value={name}
      onChange={event => {
        setName(event.target.value)
        setIsTouched(true)
      }}
      onFocus={event => {
        event.target.select()
      }}
      error={shownProblem !== null}
      helperText={shownProblem === null ? undefined : t(shownProblem)}
      slotProps={{
        htmlInput: {
          'aria-label':
            location !== null ? undefined : t('folders.create.name'),
          'data-testid': 'mailbox-name-input'
        }
      }}
    />
  )

  // Creating, the medium dialog with where the folder goes; renaming, the
  // small one with the field alone
  const isCreating = location !== null
  return (
    <FixedDialog
      open
      title={title}
      size={isCreating ? 'medium' : 'small'}
      fullScreen={false}
      onClose={onClose}
      content={
        <form id={formId} onSubmit={handleSubmit} noValidate>
          {location === null ? null : (
            <Typography component="p" className="u-mb-1">
              {t('folders.create.subtitle', { folderName: location.path })}
            </Typography>
          )}
          {field}
          {location === null ? null : (
            // Never opens its own menu: opening it asks for the picker
            <TextField
              id={locationId}
              select
              fullWidth
              className="u-mt-1"
              label={t('folders.create.location')}
              value={location.path}
              slotProps={{
                select: {
                  open: false,
                  onOpen: location.onChange,
                  renderValue: () => (
                    <span className="u-flex u-flex-items-center">
                      <Icon icon={FolderOutlined} aria-hidden="true" />
                      <span className="u-ml-half u-ellipsis">
                        {location.path}
                      </span>
                    </span>
                  ),
                  SelectDisplayProps: {
                    'aria-haspopup': 'dialog',
                    'data-testid': 'mailbox-name-location-button'
                  } as Record<string, string>
                }
              }}
            >
              <MenuItem value={location.path}>{location.path}</MenuItem>
            </TextField>
          )}
        </form>
      }
      actions={
        <>
          <Button
            variant="outlined"
            onClick={onClose}
            data-testid="mailbox-name-cancel-button"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            data-testid="mailbox-name-submit-button"
          >
            {submitLabel}
          </Button>
        </>
      }
      data-testid="mailbox-name-dialog"
    />
  )
}
