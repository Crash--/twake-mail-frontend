import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography
} from '@linagora/twake-mui'
import {
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
  const titleId = useId()
  const locationId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialName)
  const [isTouched, setIsTouched] = useState(false)
  const problem = validate(name)
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

  return (
    <Dialog
      open
      onClose={onClose}
      size="small"
      aria-labelledby={titleId}
      data-testid="mailbox-name-dialog"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id={titleId}>{title}</DialogTitle>
        <DialogContent>
          <TextField
            inputRef={inputRef}
            autoFocus
            fullWidth
            margin="dense"
            label={t('folders.create.name')}
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
            helperText={shownProblem === null ? ' ' : t(shownProblem)}
            slotProps={{
              htmlInput: { 'data-testid': 'mailbox-name-input' }
            }}
          />
          {location === null ? null : (
            <>
              <Typography
                id={locationId}
                variant="body2"
                color="textPrimary"
                className="u-mt-1"
              >
                {t('folders.create.location')}
              </Typography>
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                className="u-mt-half"
                onClick={location.onChange}
                aria-describedby={locationId}
                data-testid="mailbox-name-location-button"
              >
                {location.path}
              </Button>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            color="inherit"
            onClick={onClose}
            data-testid="mailbox-name-cancel-button"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            data-testid="mailbox-name-submit-button"
          >
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
