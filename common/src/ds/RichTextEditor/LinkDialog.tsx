// Upstream to twake-ui: with RichTextEditor.
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField
} from '@linagora/twake-mui'
import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement
} from 'react'

import type { RichTextLinkDialogLabels } from './types'

export interface LinkDialogValue {
  text: string
  url: string
}

export interface LinkDialogProps {
  open: boolean
  labels: RichTextLinkDialogLabels
  initialValue: LinkDialogValue
  /** Shows the "remove" action: the selection is in a link */
  canRemove: boolean
  onApply: (value: LinkDialogValue) => void
  onRemove: () => void
  onClose: () => void
  textInputTestId?: string
  urlInputTestId?: string
  applyButtonTestId?: string
}

/**
 * Text and URL of a link, as in tmail-flutter: Enter in the text goes to
 * the URL, Apply is enabled once the URL is not blank. MUI's Dialog traps
 * the focus and gives it back to what opened it.
 */
export function LinkDialog({
  open,
  labels,
  initialValue,
  canRemove,
  onApply,
  onRemove,
  onClose,
  textInputTestId,
  urlInputTestId,
  applyButtonTestId
}: LinkDialogProps): ReactElement {
  const titleId = useId()
  const urlRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(initialValue.text)
  const [url, setUrl] = useState(initialValue.url)
  const [opened, setOpened] = useState(open)
  // Reset the fields at each opening (state derived from props)
  if (open !== opened) {
    setOpened(open)
    if (open) {
      setText(initialValue.text)
      setUrl(initialValue.url)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (url.trim() === '') return
    onApply({ text: text.trim(), url: url.trim() })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      size="small"
      // The editor gets the focus back itself once the link is applied
      disableRestoreFocus
      // Once in place: a menu closing at the same time would take it back
      slotProps={{ transition: { onEntered: () => urlRef.current?.focus() } }}
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id={titleId}>{labels.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} className="u-pt-half">
            <TextField
              label={labels.text}
              value={text}
              onChange={event => setText(event.target.value)}
              fullWidth
              size="small"
              slotProps={{
                htmlInput: { 'data-testid': textInputTestId }
              }}
            />
            <TextField
              label={labels.url}
              value={url}
              onChange={event => setUrl(event.target.value)}
              type="url"
              inputRef={urlRef}
              required
              fullWidth
              size="small"
              slotProps={{
                htmlInput: { 'data-testid': urlInputTestId }
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          {canRemove ? (
            <Button onClick={onRemove} color="error">
              {labels.remove}
            </Button>
          ) : null}
          <Button onClick={onClose}>{labels.cancel}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={url.trim() === ''}
            data-testid={applyButtonTestId}
          >
            {labels.apply}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
