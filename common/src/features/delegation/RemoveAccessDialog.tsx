import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography
} from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

import { PersonCard, type Person } from '@/ds/PeopleList/PeopleList'
import { useI18n } from '@common/i18n/useI18n'

export interface RemoveAccessDialogProps {
  title: string
  text: string
  /** Whose access goes */
  person: Person
  /** Takes the access back; resolves once done (the dialog then closes) */
  onRemove: () => Promise<void>
  onClose: () => void
}

/**
 * "Remove delegate access?" and "Remove your access?" (tmail-flutter#4977):
 * who the access is of, Cancel, and "Remove access" in red
 */
export function RemoveAccessDialog({
  title,
  text,
  person,
  onRemove,
  onClose
}: RemoveAccessDialogProps): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const textId = useId()
  const [isRemoving, setIsRemoving] = useState(false)

  const handleRemove = (): void => {
    setIsRemoving(true)
    onRemove()
      .catch((error: unknown) => {
        console.error('[delegation] Cannot remove the access', error)
      })
      .finally(() => {
        setIsRemoving(false)
      })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="small"
      aria-labelledby={titleId}
      aria-describedby={textId}
      data-testid="delegation-remove-dialog"
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        <Typography id={textId} component="p" className="u-mb-1">
          {text}
        </Typography>
        <PersonCard person={person} data-testid="delegation-remove-person" />
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          color="primary"
          onClick={onClose}
          autoFocus
          data-testid="delegation-remove-cancel-button"
        >
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={isRemoving}
          onClick={handleRemove}
          data-testid="delegation-remove-confirm-button"
        >
          {t('delegation.remove.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
